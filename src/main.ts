import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { SoundWatcher } from './audio/sounds';
import { Input } from './input/input';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { loadArt } from './art';
import { HUB_SIZE } from './sim/data';
import { Command, ResultOf, applyCommand } from './sim/commands';
import { createDemoWorld, sustainDemo } from './sim/demo';
import { runScenario } from './sim/scenario';
import { Session } from './sim/session';
import { OldSaveError, TICK, World } from './sim/world';
import { VERSION, changelogHtml } from './ui/changelog';
import { Hud, hydrateIcons } from './ui/hud';
import { PlanBar } from './ui/plan';
import { createUIState } from './ui/state';
import { LESSONS, Tutorial } from './ui/tutorial';

const SAVE_KEY = 'foundry-front-save';
/** Progress that outlives a single game: lessons seen, tips on or off, hardcore unlocked. */
const PROFILE_KEY = 'foundry-front-profile';
const AUTOSAVE_MS = 20_000;
const MAX_TICKS_PER_FRAME = 20;

/** The saved game, or null. A save from before the new map (v8) can't be loaded, so it's cleared. */
function loadWorld(): World | null {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (json) return World.fromJSON(json);
  } catch (err) {
    if (err instanceof OldSaveError) {
      localStorage.removeItem(SAVE_KEY);
      const note = document.getElementById('mm-note');
      if (note) {
        note.textContent = 'Your saved factory was from an earlier version of the game, which used a different map. Start a new game to try the new one.';
        note.hidden = false;
      }
    } else console.warn('Could not load save.', err);
  }
  return null;
}

interface Profile {
  lessonsSeen: string[];
  tipsOff: boolean;
  hardcoreUnlocked: boolean;
  escapes: number; // games with a supply run delivered (named for the escape ship it replaced)
  confirmTouch: boolean;
  musicVolume: number; // 0–1
  sfxVolume: number; // 0–1
  lastSeenVersion: string; // the newest version whose What's new this player has opened
  batterySaver: boolean; // draw at normal resolution and 30 frames a second
}

function loadProfile(): Profile {
  const fallback: Profile = { lessonsSeen: [], tipsOff: false, hardcoreUnlocked: false, confirmTouch: true, musicVolume: 0.5, sfxVolume: 0.6, escapes: 0, lastSeenVersion: '', batterySaver: false };
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
/** That game's commands and clock (D-058). */
let session: Session | null = null;
/** The factory running behind the main menu. */
let demo = createDemoWorld();
let inMenu = true;
const active = () => (inMenu || !game ? demo : game);

/** Every change the player makes to the world goes through here, as a command (D-058). */
function issue<C extends Command>(command: C): ResultOf<C> {
  return !inMenu && session ? session.do(command) : applyCommand(active(), command);
}

const profile = loadProfile();
const ui = createUIState();
ui.confirmTouch = profile.confirmTouch;
const camera = new Camera();
const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas, camera);
renderer.maxDpr = profile.batterySaver ? 1 : 2;

function centreOnHub(world: World): void {
  const hub = world.hub;
  camera.x = hub ? hub.x + HUB_SIZE / 2 : world.state.width / 2;
  camera.y = hub ? hub.y + HUB_SIZE / 2 : world.state.height / 2;
  camera.zoom = window.innerWidth < 600 ? 26 : 34;
}

function play(world: World): void {
  game = world;
  session = new Session(world);
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
    const mins = Math.floor(s.time / 60);
    const runs = s.ship.runs;
    const where = runs ? `${runs} supply run${runs === 1 ? '' : 's'} delivered` : `${mins} min played`;
    document.getElementById('mm-continue-sub')!.textContent = s.gameOver ? `${mode} · run over` : `${mode} · ${where}`;
    if (s.gameOver) btn.hidden = true;
  }
}

const escapesCounted = new Set<number>();
const hud = new Hud(ui, {
  getWorld: active,
  issue,
  save,
  hardcoreUnlocked: () => profile.hardcoreUnlocked,
  lessons: () => LESSONS.map((l) => ({ id: l.id, title: l.title, seen: profile.lessonsSeen.includes(l.id) })),
  playLesson: (id) => tutorial.start(id),
  tipsOff: () => profile.tipsOff,
  setTipsOff: (off) => {
    profile.tipsOff = off;
    saveProfile();
  },
  resetLessons: () => {
    profile.lessonsSeen = [];
    profile.tipsOff = false;
    saveProfile();
  },
  toMainMenu: showMainMenu,
  hasGame: () => !!game || hasSave(),
  rotatePlan: () => input.rotatePlan(),
  delivered: (first) => {
    if (first) music.setMood('win');
    // Count each game's first delivery once.
    if (first && game && !escapesCounted.has(game.state.seed)) {
      escapesCounted.add(game.state.seed);
      profile.escapes++;
      // A first delivery in Standard unlocks Hardcore.
      if (game.state.mode === 'standard' && !profile.hardcoreUnlocked) {
        profile.hardcoreUnlocked = true;
        hud.toast('Hardcore mode unlocked! Start it from Menu → New game.');
      }
      saveProfile();
    }
    save();
  },
  keptPlaying: () => {
    music.setMood('game');
    save();
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
  issue,
  onPlaceError: (err) => {
    hud.placeError(err);
    sfx.play('error');
  },
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

const sfx = new Sfx(profile.sfxVolume);
const sounds = new SoundWatcher(sfx, camera);
const sfxVolume = document.getElementById('sfx-volume') as HTMLInputElement;
sfxVolume.value = String(Math.round(profile.sfxVolume * 100));
sfxVolume.addEventListener('input', () => {
  profile.sfxVolume = Number(sfxVolume.value) / 100;
  sfx.setVolume(profile.sfxVolume);
});
sfxVolume.addEventListener('change', () => {
  saveProfile();
  sfx.play('click'); // a sample at the new volume
});
// Every button clicks.
document.addEventListener('click', (e) => {
  if ((e.target as Element).closest?.('button')) sfx.play('click');
});

const saverToggle = document.getElementById('saver-toggle') as HTMLInputElement;
saverToggle.checked = profile.batterySaver;
saverToggle.addEventListener('change', () => {
  profile.batterySaver = saverToggle.checked;
  renderer.maxDpr = profile.batterySaver ? 1 : 2;
  renderer.resize();
  saveProfile();
});

const confirmToggle = document.getElementById('confirm-toggle') as HTMLInputElement;
confirmToggle.checked = profile.confirmTouch;
confirmToggle.addEventListener('change', () => {
  ui.confirmTouch = profile.confirmTouch = confirmToggle.checked;
  saveProfile();
});

document.getElementById('mm-continue')!.addEventListener('click', () => {
  const world = game ?? loadWorld();
  if (world) play(world);
  else refreshMainMenu();
});
document.getElementById('mm-new')!.addEventListener('click', () => hud.openNewGame());
document.getElementById('mm-help')!.addEventListener('click', () => hud.openModal('help'));

/** The version, and a dot on "What's new" until this player has looked at this version's changes. */
function showVersion(): void {
  for (const el of document.querySelectorAll('.app-version')) el.textContent = VERSION;
  for (const dot of document.querySelectorAll<HTMLElement>('.new-dot')) dot.hidden = profile.lastSeenVersion === VERSION;
}

function openWhatsNew(): void {
  const body = document.getElementById('changelog-body')!;
  if (!body.firstChild) body.innerHTML = changelogHtml();
  hud.openModal('changelog');
  profile.lastSeenVersion = VERSION;
  saveProfile();
  showVersion();
}
document.getElementById('mm-whatsnew')!.addEventListener('click', openWhatsNew);
document.getElementById('btn-whatsnew')!.addEventListener('click', openWhatsNew);
showVersion();

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


let last = performance.now();
let acc = 0;
let lastFrame = 0;
/**
 * Frame pacing (#46): at most 60 frames a second (a 120 Hz screen would otherwise
 * draw twice as often), and 30 while paused, on the main menu or in battery saver.
 */
function frameInterval(): number {
  return profile.batterySaver || inMenu || ui.speed === 0 ? 1000 / 30 : 1000 / 60;
}
function frame(now: number): void {
  // A little slack, so a 60 Hz screen keeps every frame and a 120 Hz one keeps every other.
  if (now - lastFrame < frameInterval() - 3) {
    requestAnimationFrame(frame);
    return;
  }
  lastFrame = now;
  const world = active();
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += elapsed * (inMenu ? 1 : ui.speed);
  let ticks = 0;
  while (acc >= TICK && ticks < MAX_TICKS_PER_FRAME) {
    if (!inMenu && session) session.tick();
    else world.tick(TICK);
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
  renderer.draw(world, inMenu ? null : ui, now, Math.min(1, acc / TICK));
  planBar.update(world, !inMenu);
  if (!inMenu) {
    hud.update(world, now);
    hud.placeStock(world, camera);
    sounds.update(world, ui.speed > 0);
    tutorial.check();
  } else {
    sfx.setHum(0); // no factory noise on the main menu
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
  sfx,
  version: VERSION,
  /** The scripted game the cross-browser determinism test runs (D-058). */
  runScenario,
};
