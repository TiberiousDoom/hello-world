// Saves the player can take away and bring back (D-172): export to a file, import from one, and the browser
// asked to keep the game's storage. A save lives only in this browser otherwise, and can be lost with it.
import { OldSaveError, World } from '../sim/world';

/** A short description of a saved game, as Continue and the lobby show it. */
export function saveSummary(world: World): string {
  const s = world.state;
  const mode = s.mode === 'hardcore' ? 'Hardcore' : 'Standard';
  const runs = s.ship.runs;
  const where = runs ? `${runs} supply run${runs === 1 ? '' : 's'} delivered` : `${Math.floor(s.time / 60)} min played`;
  return `${mode} · ${where}`;
}

/** The file name for an exported save: the game, the mode, how far in, and the day. */
export function saveFileName(world: World, date: Date): string {
  const day = date.toISOString().slice(0, 10);
  return `nestfall-${world.state.mode}-${Math.floor(world.state.time / 60)}min-${day}.json`;
}

/** A save file's text read back: the world in it, or why it can't be used. */
export function readSave(text: string): { world: World } | { error: string } {
  const notASave = { error: "That file isn't a Nestfall save, or it's damaged." };
  try {
    // A save is the game's state: an object with a version number and a map. Anything else isn't one.
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || typeof (data as { version?: unknown }).version !== 'number' || !Array.isArray((data as { buildings?: unknown }).buildings)) return notASave;
  } catch {
    return notASave;
  }
  try {
    const world = World.fromJSON(text);
    if (world.state.gameOver) return { error: 'That save is of a run that has ended, so there is nothing to continue.' };
    return { world };
  } catch (err) {
    if (err instanceof OldSaveError) return { error: 'That save is from an early version of the game, which used a different map, so it can no longer be loaded.' };
    return notASave;
  }
}

/**
 * Safari on an iPhone or iPad, in a tab rather than added to the home screen: Safari deletes a site's storage
 * after about 7 days without a visit, and the saved factory with it. Added to the home screen, it doesn't.
 */
export function iosSafariTab(ua: string, touchPoints: number, standalone: boolean): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  return ios && !standalone;
}
