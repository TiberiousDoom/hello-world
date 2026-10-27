import { describe, expect, it } from 'vitest';
import { applyCommand } from '../sim/commands';
import { footprint } from '../sim/data';
import { fightingWorld } from '../sim/scenario';
import { validCommand } from '../net/lockstep';
import { clipCorner, copyArea, pasteChunks, rotateClip } from './clipboard';
import { UNDO_GROUP_MS, UNDO_MAX, UndoStack, rebuild } from './undo';
import { bindKey, keyFor, resetKeys, toolIndex, toolKey } from './keys';

/** A world with everything researched and plenty in stock, and open ground around (cx, cy). */
function open() {
  const { w, cx, cy } = fightingWorld(5);
  for (let y = cy - 10; y <= cy + 10; y++) for (let x = cx - 10; x <= cx + 10; x++) w.state.resources[w.idx(x, y)] = w.state.trees[w.idx(x, y)] = 0;
  return { w, cx, cy };
}

describe('Copy and paste (D-144)', () => {
  it('copies the buildings inside an area with their settings, and pastes them elsewhere', () => {
    const { w, cx, cy } = open();
    const furnace = w.place('furnace', cx - 8, cy - 8, 0);
    const belt = w.place('belt', cx - 6, cy - 8, 0);
    const outside = w.place('belt', cx - 3, cy - 8, 0);
    if (typeof furnace === 'string' || typeof belt === 'string' || typeof outside === 'string') throw new Error('not placed');
    w.setRecipe(furnace.id, 'brick');
    const clip = copyArea(w, cx - 8, cy - 8, cx - 5, cy - 7)!;
    expect(clip.items.map((i) => i.type)).toEqual(['furnace', 'belt']);
    expect(clip).toMatchObject({ w: 4, h: 2 });
    expect(clip.items[0]).toMatchObject({ dx: 0, dy: 0, recipe: 'brick' });

    const r = applyCommand(w, { kind: 'paste', x: cx, y: cy, items: clip.items });
    expect(r.failed).toBe(0);
    expect(r.ids.length).toBe(2);
    const copy = w.byId.get(r.ids[0])!;
    expect(copy).toMatchObject({ type: 'furnace', x: cx, y: cy, recipe: 'brick' });
    expect(w.buildingAt(cx + 2, cy)?.type).toBe('belt');

    // Pasting over itself: everything is in the way.
    expect(applyCommand(w, { kind: 'paste', x: cx, y: cy, items: clip.items })).toEqual({ ids: [], failed: 2 });
  });

  it('leaves out the hub, and finds nothing in an empty area', () => {
    const { w, cx, cy } = open();
    const hub = w.hub!;
    expect(copyArea(w, hub.x - 1, hub.y - 1, hub.x + 9, hub.y + 9)?.items.some((i) => i.type === 'hub') ?? false).toBe(false);
    expect(copyArea(w, cx - 2, cy - 2, cx + 2, cy + 2)).toBeNull();
  });

  it('turns a copy a quarter at a time, every building staying inside it, and back after four turns', () => {
    const { w, cx, cy } = open();
    w.place('splitter', cx - 8, cy - 8, 0); // 1×2 facing east
    w.place('furnace', cx - 7, cy - 8, 0);
    w.place('belt', cx - 5, cy - 7, 1);
    const clip = copyArea(w, cx - 8, cy - 8, cx - 5, cy - 7)!;
    let turned = clip;
    for (let k = 1; k <= 4; k++) {
      turned = rotateClip(turned);
      for (const it of turned.items) {
        const [fw, fh] = footprint(it.type, it.dir);
        expect(it.dx).toBeGreaterThanOrEqual(0);
        expect(it.dy).toBeGreaterThanOrEqual(0);
        expect(it.dx + fw).toBeLessThanOrEqual(turned.w);
        expect(it.dy + fh).toBeLessThanOrEqual(turned.h);
      }
      if (k === 1) {
        expect(turned).toMatchObject({ w: 2, h: 4 });
        const r = applyCommand(w, { kind: 'paste', x: cx, y: cy, items: turned.items });
        expect(r.failed).toBe(0); // nothing overlaps once turned
      }
    }
    expect(turned).toEqual(clip);
  });

  it('centres on the tile it goes to, and splits big copies into commands a guest may send', () => {
    expect(clipCorner({ items: [], w: 4, h: 3 }, { x: 10, y: 10 })).toEqual({ x: 9, y: 9 });
    const items = Array.from({ length: 95 }, (_, i) => ({ type: 'belt' as const, dx: i % 50, dy: Math.floor(i / 50), dir: 0 as const }));
    const chunks = pasteChunks(items);
    expect(chunks.map((c) => c.length)).toEqual([40, 40, 15]);
    for (const c of chunks) expect(validCommand({ kind: 'paste', x: 5, y: 5, items: c })).toBe(true);
  });

  it("refuses a guest's paste that's too big, or carries something odd", () => {
    const belt = { type: 'belt', dx: 0, dy: 0, dir: 0 };
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: [belt] })).toBe(true);
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: Array(41).fill(belt) })).toBe(false);
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: 'belt' })).toBe(false);
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: [{ ...belt, type: 'hub' }] })).toBe(false);
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: [{ ...belt, dx: 1.5 }] })).toBe(false);
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: [{ ...belt, dx: 1e9 }] })).toBe(false);
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: [{ ...belt, recipe: '__proto__' }] })).toBe(false);
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: [{ ...belt, filter: 'constructor' }] })).toBe(false);
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: [{ ...belt, side: 'up' }] })).toBe(false);
    expect(validCommand({ kind: 'paste', x: 1, y: 1, items: [null] })).toBe(false);
  });
});

describe('Undo (D-144)', () => {
  it('groups changes made close together into one step, and keeps the last fifty', () => {
    const u = new UndoStack();
    u.record({ kind: 'demolish', id: 1 }, 0);
    u.record({ kind: 'demolish', id: 2 }, UNDO_GROUP_MS - 1);
    u.record({ kind: 'demolish', id: 3 }, 2 * UNDO_GROUP_MS + 10);
    expect(u.size).toBe(2);
    expect(u.pop()).toEqual([{ kind: 'demolish', id: 3 }]);
    expect(u.pop()).toEqual([
      { kind: 'demolish', id: 2 },
      { kind: 'demolish', id: 1 },
    ]);
    expect(u.pop()).toBeUndefined();
    for (let i = 0; i < UNDO_MAX + 10; i++) u.record({ kind: 'demolish', id: i }, i * 1000);
    expect(u.size).toBe(UNDO_MAX);
  });

  it('builds a demolished building again as it was set up', () => {
    const { w, cx, cy } = open();
    const f = w.place('furnace', cx, cy, 2);
    if (typeof f === 'string') throw new Error(f);
    w.setRecipe(f.id, 'copper_ingot');
    const back = rebuild(f);
    w.demolish(f.id);
    expect(w.buildingAt(cx, cy)).toBeUndefined();
    const r = applyCommand(w, back);
    expect(r).toMatchObject({ failed: 0 });
    expect(w.buildingAt(cx, cy)).toMatchObject({ type: 'furnace', dir: 2, recipe: 'copper_ingot' });
  });
});

describe('Keys (D-144)', () => {
  it('rebinds an action, swapping with whatever had the key, and refuses keys that have jobs', () => {
    resetKeys();
    expect(bindKey('rotate', 't')).toBe(true);
    expect(keyFor('rotate')).toBe('t');
    expect(bindKey('demolish', 'T')).toBe(true); // the same key: rotate takes demolish's old one
    expect(keyFor('demolish')).toBe('t');
    expect(keyFor('rotate')).toBe('x');
    expect(bindKey('pause', 'w')).toBe(false);
    expect(bindKey('pause', 'Escape')).toBe(false);
    expect(bindKey('pause', '5')).toBe(false);
    resetKeys();
    expect(keyFor('rotate')).toBe('r');
  });

  it('numbers the toolbar 1–9, 0, then Shift+1–9', () => {
    expect([0, 8, 9, 10, 18, 19].map(toolKey)).toEqual(['1', '9', '0', 'Shift+1', 'Shift+9', null]);
    const press = (code: string, shiftKey = false) => toolIndex({ code, shiftKey, ctrlKey: false, metaKey: false, altKey: false } as KeyboardEvent);
    expect([press('Digit1'), press('Digit0'), press('Digit1', true), press('Digit9', true), press('Digit0', true), press('KeyA')]).toEqual([0, 9, 10, 18, null, null]);
  });
});
