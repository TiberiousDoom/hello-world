// Key bindings (D-144): the keyboard shortcuts, which the player can change in Settings. Kept in this
// browser. Walking (WASD and the arrows), Esc, Enter, Ctrl+Z and the number keys stay as they are.

export type KeyAction = 'rotate' | 'demolish' | 'cancel' | 'inventory' | 'pause' | 'ping' | 'undo' | 'copy' | 'paste';

/** Each action, its name in Settings, and its key by default (as KeyboardEvent.key, lower case). */
export const KEY_ACTIONS: { id: KeyAction; label: string; key: string }[] = [
  { id: 'rotate', label: 'Rotate (Shift: the other way)', key: 'r' },
  { id: 'demolish', label: 'Demolish', key: 'x' },
  { id: 'cancel', label: 'Put down the tool (Esc too)', key: 'q' },
  { id: 'inventory', label: 'Inventory', key: 'i' },
  { id: 'pause', label: 'Pause', key: ' ' },
  { id: 'ping', label: 'Point at a spot (co-op)', key: 'p' },
  { id: 'undo', label: 'Undo (Ctrl+Z too)', key: 'z' },
  { id: 'copy', label: 'Copy an area', key: 'c' },
  { id: 'paste', label: 'Paste', key: 'v' },
];

/** Keys that can't be bound: walking, and the keys plans and menus use. */
export const RESERVED_KEYS: readonly string[] = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape', 'enter', 'tab', 'delete', ...'0123456789'];

const STORE = 'foundry-front-keys';

function load(): Record<KeyAction, string> {
  const keys = Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, a.key])) as Record<KeyAction, string>;
  try {
    const stored = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<Record<KeyAction, string>>;
    for (const a of KEY_ACTIONS) if (typeof stored[a.id] === 'string') keys[a.id] = stored[a.id]!;
  } catch {
    // Private mode or bad data: the defaults.
  }
  return keys;
}

const bound = load();
let version = 0;

/** Goes up whenever a key changes, so screens showing keys know to redraw. */
export function keysVersion(): number {
  return version;
}

/** The key an action is on. */
export function keyFor(action: KeyAction): string {
  return bound[action];
}

/** Whether a key press is the given action's key (modifiers aside: Shift turns the other way, say). */
export function isKey(e: KeyboardEvent, action: KeyAction): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === bound[action];
}

/**
 * Puts an action on a key. An action already on that key swaps onto this one's old key, so no two
 * share one. Returns false for a key that can't be bound.
 */
export function bindKey(action: KeyAction, key: string): boolean {
  const k = key.toLowerCase();
  if (RESERVED_KEYS.includes(k) || k.length === 0 || k === 'shift' || k === 'control' || k === 'alt' || k === 'meta') return false;
  const other = KEY_ACTIONS.find((a) => a.id !== action && bound[a.id] === k);
  if (other) bound[other.id] = bound[action];
  bound[action] = k;
  save();
  return true;
}

/** Every action back on its default key. */
export function resetKeys(): void {
  for (const a of KEY_ACTIONS) bound[a.id] = a.key;
  save();
}

function save(): void {
  version++;
  try {
    localStorage.setItem(STORE, JSON.stringify(bound));
  } catch {
    // Kept for this visit only.
  }
}

/** A key's name for the screen. */
export function keyName(key: string): string {
  if (key === ' ') return 'Space';
  return key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1);
}

/** An action's key, ready to go into HTML: a key such as " or < would otherwise break the markup around it. */
export function keyHtml(action: KeyAction): string {
  return keyName(keyFor(action)).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The hotkey for the toolbar's `i`th tool (from 0): 1–9, 0, then Shift+1–9. Null past the 19th. */
export function toolKey(i: number): string | null {
  if (i < 9) return String(i + 1);
  if (i === 9) return '0';
  if (i < 19) return `Shift+${i - 9}`;
  return null;
}

/** The toolbar index a key press picks (`toolKey` the other way round), or null. */
export function toolIndex(e: KeyboardEvent): number | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const m = /^Digit(\d)$/.exec(e.code);
  const d = m ? Number(m[1]) : Number.NaN;
  if (Number.isNaN(d)) return null;
  if (e.shiftKey) return d >= 1 ? 9 + d : null;
  return d === 0 ? 9 : d - 1;
}

/**
 * Whether a dialog is open over the game. Shortcuts wait while one is: Space would unpause a dialog
 * that paused the game, and number keys and walking would act behind it. The blueprint offer shown as
 * a small card leaves the game playable, so it doesn't count.
 */
export function dialogOpen(): boolean {
  return !!document.querySelector('.modal:not([hidden]):not(.offer-card)');
}
