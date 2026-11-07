// The game was first called Foundry Front (D-167), and its browser storage kept that name in its keys. They're
// `nestfall-…` now (D-194): on loading, anything under an old key moves to its new one, once, before the rest
// of the game reads storage. main.ts imports this first.

const OLD = 'foundry-front-';
const NEW = 'nestfall-';

/** Moves every `foundry-front-…` key to `nestfall-…`, keeping a new key that already exists. */
export function moveOldStorage(storage: Storage): void {
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (!key?.startsWith(OLD)) continue;
    const moved = NEW + key.slice(OLD.length);
    const value = storage.getItem(key);
    if (value != null && storage.getItem(moved) == null) storage.setItem(moved, value);
    storage.removeItem(key);
  }
}

try {
  moveOldStorage(localStorage);
} catch {
  // Storage blocked (a private window, a setting): nothing to move.
}
