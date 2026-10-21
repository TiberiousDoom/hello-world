import { Music } from './audio/music';
import { Input } from './input/input';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { loadArt } from './art';
import { HARDCORE_UNLOCK_WAVE, HUB_SIZE } from './sim/data';
import { createDemoWorld, sustainDemo } from './sim/demo';
import { TICK, World } from './sim/world';
import { Hud, hydrateIcons } from './ui/hud';
import { PlanBar } from './ui/plan';
import { createUIState } from './ui/state';
import { LESSONS, Tutorial } from './ui/tutorial';

const SAVE_KEY = 'foundry-front-save';
/** Progress that outlives a single game: lessons seen, tips on or off, hardcore unlocked. */
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
  lessonsSeen: string[];
  tipsOff: boolean;
  hardcoreUnlocked: boolean;
  escapes: number;
  confirmTouch: boolean;
  musicVolume: number; // 0–1
}

function loadProfile(): Profile {
  const fallback: Profile = { lessonsSeen: [], tipsOff: false, hardcoreUnlocked: false, confirmTouch: true, musicVolume: 0.5, escapes: 0 };
  try {
    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
    // Players who finished the old one-shot tutorial have seen what its lessons cover.
    if (stored.tutorialDone && !stored.lessonsSeen) stored.lessonsSeen = ['essentials', 'contracts', 'defense'];
    delete stored.tutorialDone;
    return { ...fallback, ...stored };
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
  if (!game) return; // the menu's demo world is never saved
  try {
    localStorage.setItem(SAVE_KEY, game.toJSON());
  } catch (err) {
    console.warn('Could not save game.', err);
  }
}

function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) != null;
  } catch {
    return false;
  }
}

/** The player's game, once one is started or continued. */
let game: World | null = null;
/** The factory running behind the main menu. */
let demo = createDemoWorld();
let inMenu = true;
const active = () => (inMenu || !game ? demo : game);

const profile = loadProfile();
const ui = createUIState();
ui.confirmTouch = profile.confirmTouch;
const camera = new Camera();
const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas, camera);

function centreOnHub(world: World): void {
  const hub = world.hub;
  camera.x = hub ? hub.x + HUB_SIZE / 2 : world.state.width / 2;
  camera.y = hub ? hub.y + HUB_SIZE / 2 : world.state.height / 2;
  camera.zoom = window.innerWidth < 600 ? 26 : 34;
}

function play(world: World): void {
  game = world;
  inMenu = false;
  document.body.classList.remove('in-menu');
  ui.selected = null;
  ui.tool = null;
  ui.speed = 1;
  centreOnHub(world);
  hud.closeModals();
  hud.refresh();
  music.setMood('game');
}

function showMainMenu(): void {
  save();
  inMenu = true;
  document.body.classList.add('in-menu');
  demo = createDemoWorld();
  camera.zoom = window.innerWidth < 600 ? 26 : 38;
  if (tutorial.active) tutorial.abort();
  hud.closeModals();
  refreshMainMenu();
  music.setMood('menu');
}

function refreshMainMenu(): void {
  const btn = document.getElementById('mm-continue')!;
  let saved: World | null = game;
  if (!saved && hasSave()) saved = loadWorld();
  btn.hidden = !saved;
  if (saved) {
    const s = saved.state;
    const mode = s.mode === 'hardcore' ? 'Hardcore' : 'Standard';
    const where = s.ship.endless ? `Endless · wave ${s.wave + 1} next` : s.ship.escaped ? 'escaped!' : `wave ${s.wave + 1} next`;
    document.getElementById('mm-continue-sub')!.textContent = s.gameOver ? `${mode} · run over` : `${mode} · ${where}`;
    if (s.gameOver) btn.hidden = true;
  }
}

const escapesCounted = new Set<number>();
const hud = new Hud(ui, {
  getWorld: active,
  save,
  hardcoreUnlocked: () => profile.hardcoreUnlocked,
  lessons: () => LESSONS.map((l) => ({ id: l.id, title: l.title, seen: profile.lessonsSeen.includes(l.id) })),
  playLesson: (id) => tutorial.start(id),
  tipsOff: () => profile.tipsOff,
  setTipsOff: (off) => {
    profile.tipsOff = off;
    saveProfile();
  },
  toMainMenu: showMainMenu,
  hasGame: () => !!game || hasSave(),
  rotatePlan: () => input.rotatePlan(),
  escaped: () => {
    music.setMood('win');
    // Count each run's escape once, however often its victory screen is reopened.
    if (game && !escapesCounted.has(game.state.seed)) {
      escapesCounted.add(game.state.seed);
      profile.escapes++;
      saveProfile();
    }
    save();
  },
  cameBack: () => {
    music.setMood('game');
    save();
  },
  centreOnHub: () => {
    const hub = active().hub;
    if (hub) [camera.x, camera.y] = [hub.x + HUB_SIZE / 2, hub.y + HUB_SIZE / 2];
  },
  newGame: (mode, withTutorial) => {
    play(World.create(undefined, mode));
    save();
    // Ticked: show the basics even if they were seen (or lessons are off). Unticked: skip them.
    if (withTutorial) tutorial.start('essentials');
    else if (!profile.lessonsSeen.includes('essentials')) {
      profile.lessonsSeen.push('essentials');
      saveProfile();
    }
  },
  essentialsSeen: () => profile.lessonsSeen.includes('essentials'),
});

const tutorial = new Tutorial(camera, active, ui, {
  seen: (id) => profile.lessonsSeen.includes(id),
  markSeen: (id) => {
    if (!profile.lessonsSeen.includes(id)) profile.lessonsSeen.push(id);
    saveProfile();
  },
  tipsOff: () => profile.tipsOff,
  setTipsOff: (off) => {
    profile.tipsOff = off;
    saveProfile();
  },
});

const input = new Input(canvas, camera, ui, {
  getWorld: active,
  onPlaceError: (err) => hud.placeError(err),
  onChange: () => hud.refresh(),
});
const planBar = new PlanBar(camera, ui, {
  confirm: () => input.confirmPlan(),
  rotate: () => input.rotatePlan(),
  cancel: () => input.cancelPlan(),
});

const music = new Music(profile.musicVolume);
const volume = document.getElementById('music-volume') as HTMLInputElement;
volume.value = String(Math.round(profile.musicVolume * 100));
volume.addEventListener('input', () => {
  profile.musicVolume = Number(volume.value) / 100;
  music.setVolume(profile.musicVolume);
});
volume.addEventListener('change', saveProfile);

const confirmToggle = document.getElementById('confirm-toggle') as HTMLInputElement;
confirmToggle.checked = profile.confirmTouch;
confirmToggle.addEventListener('change', () => {
  ui.confirmTouch = profile.confirmTouch = confirmToggle.checked;
  saveProfile();
});

document.getElementById('mm-continue')!.addEventListener('click', () => play(game ?? loadWorld()));
document.getElementById('mm-new')!.addEventListener('click', () => hud.openNewGame());
document.getElementById('mm-help')!.addEventListener('click', () => hud.openModal('help'));

window.addEventListener('resize', () => renderer.resize());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
});
window.addEventListener('pagehide', save);
setInterval(save, AUTOSAVE_MS);

hydrateIcons();
renderer.resize();
showMainMenu();
loadArt(); // sprites appear as they finish loading; shapes are drawn until then

/** Surviving enough waves in standard mode unlocks hardcore. */
function checkUnlocks(): void {
  if (!game || inMenu) return;
  const s = game.state;
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
  const world = active();
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += elapsed * (inMenu ? 1 : ui.speed);
  let ticks = 0;
  while (acc >= TICK && ticks < MAX_TICKS_PER_FRAME) {
    world.tick(TICK);
    if (inMenu) sustainDemo(world);
    acc -= TICK;
    ticks++;
  }
  if (ticks === MAX_TICKS_PER_FRAME) acc = 0;
  if (inMenu) {
    // Drift slowly around the demo factory.
    const hub = world.hub!;
    const t = now / 1000;
    camera.x = hub.x + HUB_SIZE / 2 + Math.sin(t * 0.07) * 6 + (window.innerWidth >= 600 ? -4 : 0);
    camera.y = hub.y + HUB_SIZE / 2 + Math.cos(t * 0.05) * 4 + (window.innerWidth < 600 ? 5 : 0);
  }
  camera.clampTo(world.state.width, world.state.height);
  renderer.draw(world, inMenu ? null : ui, now);
  planBar.update(world, !inMenu);
  if (!inMenu) {
    hud.update(world, now);
    hud.placeStock(world, camera);
    tutorial.check();
  }
  tutorial.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handle for debugging and automated browser tests.
(window as unknown as { game: unknown }).game = {
  get world() {
    return active();
  },
  get inMenu() {
    return inMenu;
  },
  camera,
  ui,
  music,
};
