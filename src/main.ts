import { Input } from './input/input';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { HARDCORE_UNLOCK_WAVE, HUB_SIZE } from './sim/data';
import { TICK, World } from './sim/world';
import { Hud } from './ui/hud';
import { createUIState } from './ui/state';
import { Tutorial } from './ui/tutorial';

const SAVE_KEY = 'foundry-front-save';
/** Progress that outlives a single game: tutorial seen, hardcore unlocked. */
const PROFILE_KEY = 'foundry-front-profile';
const AUTOSAVE_MS = 20_000;
const MAX_TICKS_PER_FRAME = 20;

function loadWorld(): World {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (json) return World.fromJSON(json);
  } catch (err) {
    console.warn('Could not load save, starting fresh.', err);
  }
  return World.create();
}

interface Profile {
  tutorialDone: boolean;
  hardcoreUnlocked: boolean;
}

function loadProfile(): Profile {
  const fallback: Profile = { tutorialDone: false, hardcoreUnlocked: false };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}') };
  } catch {
    return fallback;
  }
}

function saveProfile(): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage can be unavailable (private windows); the profile then lasts for this visit.
  }
}

function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, world.toJSON());
  } catch (err) {
    console.warn('Could not save game.', err);
  }
}

const hadSave = (() => {
  try {
    return localStorage.getItem(SAVE_KEY) != null;
  } catch {
    return false;
  }
})();
let world = loadWorld();
const profile = loadProfile();
const ui = createUIState();
const camera = new Camera();
const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas, camera);

function centreOnHub(): void {
  const hub = world.hub;
  camera.x = hub ? hub.x + HUB_SIZE / 2 : world.state.width / 2;
  camera.y = hub ? hub.y + HUB_SIZE / 2 : world.state.height / 2;
  camera.zoom = window.innerWidth < 600 ? 26 : 34;
}

const hud = new Hud(ui, {
  getWorld: () => world,
  save,
  hardcoreUnlocked: () => profile.hardcoreUnlocked,
  startTutorial: () => tutorial.start(),
  newGame: (mode) => {
    world = World.create(undefined, mode);
    ui.selected = null;
    ui.tool = null;
    centreOnHub();
    save();
    hud.closeModals();
    hud.refresh();
  },
});

const tutorial = new Tutorial(camera, () => world, ui, () => {
  profile.tutorialDone = true;
  saveProfile();
});

new Input(canvas, camera, ui, {
  getWorld: () => world,
  onPlaceError: (err) => hud.placeError(err),
  onChange: () => hud.refresh(),
});

window.addEventListener('resize', () => renderer.resize());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
});
window.addEventListener('pagehide', save);
setInterval(save, AUTOSAVE_MS);

renderer.resize();
centreOnHub();
if (!profile.tutorialDone && !hadSave) tutorial.start();

/** Surviving enough waves in standard mode unlocks hardcore. */
function checkUnlocks(): void {
  const s = world.state;
  const cleared = s.wave >= HARDCORE_UNLOCK_WAVE && !s.enemies.length && !s.spawnQueue.length;
  if (s.mode === 'standard' && cleared && !profile.hardcoreUnlocked) {
    profile.hardcoreUnlocked = true;
    saveProfile();
    hud.toast('Hardcore mode unlocked! Start it from Menu → New game.');
  }
}
setInterval(checkUnlocks, 1000);

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += elapsed * ui.speed;
  let ticks = 0;
  while (acc >= TICK && ticks < MAX_TICKS_PER_FRAME) {
    world.tick(TICK);
    acc -= TICK;
    ticks++;
  }
  if (ticks === MAX_TICKS_PER_FRAME) acc = 0;
  camera.clampTo(world.state.width, world.state.height);
  renderer.draw(world, ui, now);
  hud.update(world, now);
  tutorial.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handle for debugging and automated browser tests.
(window as unknown as { game: unknown }).game = { get world() { return world; }, camera, ui };
