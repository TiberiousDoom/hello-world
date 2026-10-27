import { Music } from './audio/music';
import { Sfx } from './audio/sfx';
import { Critters } from './audio/critters';
import { SoundWatcher } from './audio/sounds';
import { Input } from './input/input';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { loadArt } from './art';
import { HUB_SIZE } from './sim/data';
import { Command, ResultOf, applyCommand } from './sim/commands';
import { DEMO_SCENES, createDemoWorld, sustainDemo } from './sim/demo';
import { runScenario } from './sim/scenario';
import { LoggedCommand, Session } from './sim/session';
import { OldSaveError, PlaceError, TICK, World } from './sim/world';
import { VERSION, changelogHtml } from './ui/changelog';
import { clockAt } from './sim/clock';
import { ErrorLog, FeedbackKind, FrameRate, diagnostics, issueUrl, report } from './ui/feedback';
import { Hud, hydrateIcons } from './ui/hud';
import { PlanBar } from './ui/plan';
import { PING_MS, createUIState } from './ui/state';
import { LESSONS, Tutorial } from './ui/tutorial';
import { Lobby } from './ui/lobby';
import { RELAY_URL, SERVER_ROOM, roomStatus } from './net/client';
import { Coop } from './net/coop';
import { CATCH_UP } from './net/lockstep';

const SAVE_KEY = 'foundry-front-save';
/** The last co-op game, kept by every player apart from their own factory (D-079). */
const COOP_SAVE_KEY = 'foundry-front-coop-save';
/** Progress that outlives a single game: lessons seen, tips on or off, hardcore unlocked. */
const PROFILE_KEY = 'foundry-front-profile';
const AUTOSAVE_MS = 20_000;
const MAX_TICKS_PER_FRAME = 20;

// For the feedback form's diagnostics: the last few errors, and the recent frame rate.
const errorLog = new ErrorLog();
window.addEventListener('error', (e) => errorLog.push(`${e.message} (${e.filename?.split('/').pop() ?? '?'}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => errorLog.push(`Unhandled: ${String(e.reason)}`));
const frameRate = new FrameRate();

/** The saved game, or null. A save from before the new map (v8) can't be loaded, so it's cleared. */
function loadWorld(key = SAVE_KEY): World | null {
  try {
    const json = localStorage.getItem(key);
    if (json) return World.fromJSON(json);
  } catch (err) {
    if (err instanceof OldSaveError) {
      localStorage.removeItem(key);
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
    localStorage.setItem(saveKey, game.toJSON());
  } catch (err) {
    console.warn('Could not save game.', err);
  }
}

function hasSave(key = SAVE_KEY): boolean {
  try {
    return localStorage.getItem(key) != null;
  } catch {
    return false;
  }
}

/** The player's game, once one is started or continued. */
let game: World | null = null;
/** That game's commands and clock (D-058). */
let session: Session | null = null;
/** Where it saves: your own factory's slot, or the co-op game's (D-079). */
let saveKey = SAVE_KEY;
/** The slot a hosted co-op game will save to: your factory's if you host it, else the co-op slot. */
let hostSaveKey = COOP_SAVE_KEY;
/** The factory running behind the main menu: one example scene after another (#99). */
let demoScene = 0;
let demo = createDemoWorld(demoScene);
/** When the current scene began (page clock, ms); after DEMO_SCENE_MS the next one fades in. */
let demoSince = performance.now();
const DEMO_SCENE_MS = 40000;
let demoSwapping = false;
const showDemoCaption = () => (document.getElementById('demo-caption')!.textContent = DEMO_SCENES[demoScene % DEMO_SCENES.length].name);
/** Fades to the next example factory and back. */
function nextDemoScene(): void {
  if (demoSwapping) return;
  demoSwapping = true;
  document.getElementById('demo-fade')!.classList.add('on');
  setTimeout(() => {
    demoScene = (demoScene + 1) % DEMO_SCENES.length;
    demo = createDemoWorld(demoScene);
    demoSince = performance.now();
    showDemoCaption();
    document.getElementById('demo-fade')!.classList.remove('on');
    demoSwapping = false;
  }, 650);
}
showDemoCaption();
let inMenu = true;
const active = () => (inMenu || !game ? demo : game);

/** The co-op room, if any (D-078). `?relay=` picks another relay: a local one, or `local` for two tabs. */
const params = new URLSearchParams(location.search);
const relay = params.get('relay') ?? RELAY_URL;
const coop = new Coop(relay, VERSION);
/** The dedicated server's room (D-086): `?server=CODE` picks another, for testing. */
const serverRoom = (params.get('server') ?? SERVER_ROOM).toUpperCase();

/**
 * Every change the player makes to the world goes through here, as a command (D-058). In co-op it
 * goes to the host, which says on which tick every game applies it; the result comes back later.
 */
function issue<C extends Command>(command: C): ResultOf<C> | undefined {
  if (inMenu || !session) return applyCommand(active(), command);
  if (coop.host) return void coop.host.submit(0, command);
  if (coop.guest) return void coop.guest.submit(command);
  return session.do(command);
}

/** In co-op, this player's commands answer a few ticks late: report their errors then. */
let lastPlaceError = 0;
function lateResult(entry: LoggedCommand, result: unknown): void {
  if (!session || entry.player !== session.player || !ui.coop) return;
  const c = entry.command;
  if (c.kind === 'mine' && result === 'full') hud.toast('Your inventory is full. Walk back to the hub to drop it off.');
  if (c.kind === 'mine' && result === 'down') hud.toast('Your engineer is getting back on their feet at the hub.');
  if ((c.kind === 'place' || c.kind === 'upgrade-belts' || c.kind === 'upgrade') && typeof result === 'string' && result !== 'occupied' && result !== 'bounds') {
    // One a second at most: a drag can fail on many tiles, and the input may have said so already.
    placeError(result as PlaceError);
  }
}

const profile = loadProfile();
const ui = createUIState();
ui.confirmTouch = profile.confirmTouch;
const camera = new Camera();
const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas, camera);
renderer.maxDpr = profile.batterySaver ? 1 : 2;
camera.zoom = window.innerWidth < 600 ? 22 : 30; // the main menu's view of its example factory

function centreOnHub(world: World): void {
  const hub = world.hub;
  camera.x = hub ? hub.x + HUB_SIZE / 2 : world.state.width / 2;
  camera.y = hub ? hub.y + HUB_SIZE / 2 : world.state.height / 2;
  camera.zoom = window.innerWidth < 600 ? 26 : 34;
}

/** Plays a game: alone, or the shared game of a co-op room (its session made there). */
function play(world: World, shared?: Session): void {
  if (!shared && coop.active) coop.leave();
  useSession(world, shared);
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

/** Makes this the game being played: the camera and the rest of the screen stay as they are. */
function useSession(world: World, shared?: Session): void {
  game = world;
  session = shared ?? new Session(world);
  session.onApplied = lateResult;
  ui.coop = shared ? coop.role : null;
  ui.player = session.player;
  saveKey = ui.coop === 'host' ? hostSaveKey : ui.coop === 'guest' ? COOP_SAVE_KEY : SAVE_KEY;
  document.body.classList.toggle('coop-guest', ui.coop === 'guest');
}

function showMainMenu(): void {
  save();
  if (ui.coop) {
    // Leaving a co-op game leaves its room (the host's leaving ends it for everyone).
    coop.leave();
    endCoop();
  }
  if (saveKey !== SAVE_KEY) {
    // A co-op game is saved in its own slot; Continue is for your own factory.
    game = null;
    session = null;
    saveKey = SAVE_KEY;
  }
  inMenu = true;
  document.body.classList.add('in-menu');
  demo = createDemoWorld(demoScene);
  demoSince = performance.now();
  showDemoCaption();
  camera.zoom = window.innerWidth < 600 ? 22 : 30;
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

/**
 * Back to playing alone. A guest's copy of the shared game stays in its co-op slot (D-079), to host
 * later; it isn't the game Continue resumes.
 */
function endCoop(): void {
  if (ui.coop === 'guest') {
    save();
    game = null;
    session = null;
    saveKey = SAVE_KEY;
  }
  ui.coop = null;
  ui.pings = [];
  ui.player = 0;
  document.body.classList.remove('coop-guest');
}

/** This player points at tile (x, y) for the others (co-op, D-080): at most once a second. */
let lastPing = -Infinity;
function ping(x: number, y: number): boolean {
  if (inMenu || !ui.coop) return false;
  if (performance.now() - lastPing < 1000) return true;
  lastPing = performance.now();
  coop.ping(x, y);
  showPing(ui.player, x, y);
  return true;
}

/** A ping on the map, with its sound. */
function showPing(player: number, x: number, y: number): void {
  const now = performance.now();
  ui.pings = [...ui.pings.filter((p) => now - p.at < PING_MS), { player, x, y, at: now }].slice(-12);
  sfx.play('ping');
}

/** A building that can't go up. In co-op, said at most once a second: it may come again when the command lands. */
function placeError(err: PlaceError): void {
  if (ui.coop && performance.now() - lastPlaceError < 1000) return;
  lastPlaceError = performance.now();
  hud.placeError(err);
  sfx.play('error');
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
  onPlaceError: placeError,
  onNotice: (text) => hud.toast(text),
  onChange: () => hud.refresh(),
  ping,
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
const critters = new Critters(sfx);
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

/** A line about a saved game for the lobby, or null if there's none that can be hosted. */
function describeSave(world: World | null): string | null {
  if (!world || world.state.gameOver) return null;
  const mins = Math.floor(world.state.time / 60);
  return `${world.state.mode === 'hardcore' ? 'Hardcore' : 'Standard'} · ${mins} min played`;
}

const lobby = new Lobby(coop, {
  saves: () => ({
    solo: describeSave(saveKey === SAVE_KEY && game ? game : hasSave() ? loadWorld() : null),
    coop: describeSave(hasSave(COOP_SAVE_KEY) ? loadWorld(COOP_SAVE_KEY) : null),
  }),
  start: (choice) => {
    hostSaveKey = choice === 'solo' ? SAVE_KEY : COOP_SAVE_KEY;
    const world = choice === 'solo' ? (saveKey === SAVE_KEY && game ? game : loadWorld()) : choice === 'coop' ? loadWorld(COOP_SAVE_KEY) : null;
    void coop.start(world ?? World.create(undefined, 'standard'));
  },
  openModal: (id) => hud.openModal(id),
  closeModals: () => hud.closeModals(),
  server: { code: serverRoom, status: () => roomStatus(relay, serverRoom, AbortSignal.timeout(8000)) },
  version: VERSION,
});
document.getElementById('mm-coop')!.addEventListener('click', () => lobby.open());
coop.onChange = () => lobby.render();
coop.onStart = (shared, again) => {
  // A fresh copy of the game a guest was already playing: swap it in where the player is looking.
  if (again) return useSession(shared.world, shared);
  play(shared.world, shared);
  save();
  hud.toast(coop.role === 'host' ? 'Playing together. Only you can pause or change the speed.' : 'Playing together. The host sets the speed.');
};
coop.onNotice = (text) => hud.toast(text);
coop.onPing = showPing;
coop.onEnd = (why) => {
  if (ui.coop === 'host') {
    // The host's game is its own: it carries on alone.
    endCoop();
    hud.toast(`${why} You carry on alone.`);
    return;
  }
  if (ui.coop) {
    // A guest's game was under way: saved, then back to the menu, saying why.
    endCoop();
    showMainMenu();
    lobby.open();
    why += ' It’s saved in this browser: host it from here to carry on.';
  }
  lobby.ended(why);
};

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
/** Send feedback (D-064): the report is built here and handed to GitHub, the clipboard or a file; the game sends nothing itself. */
const fbText = document.getElementById('fb-text') as HTMLTextAreaElement;
const fbDiag = document.getElementById('fb-diag') as HTMLInputElement;
const fbStatus = document.getElementById('fb-status')!;
const fbKind = (): FeedbackKind => (document.querySelector<HTMLInputElement>('input[name="fb-kind"]:checked')?.value ?? 'other') as FeedbackKind;
function currentDiagnostics(): string {
  return diagnostics({
    version: VERSION,
    userAgent: navigator.userAgent,
    screen: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
    touch: matchMedia('(pointer: coarse)').matches,
    batterySaver: profile.batterySaver,
    fps: frameRate.fps,
    errors: errorLog.entries,
    world: game,
    speed: ui.speed,
  });
}
function currentReport(): { title: string; body: string } {
  return report(fbKind(), fbText.value, fbDiag.checked ? currentDiagnostics() : null);
}
function openFeedback(): void {
  document.getElementById('fb-diag-text')!.textContent = currentDiagnostics();
  fbStatus.textContent = '';
  hud.openModal('feedback');
  fbText.focus();
}
document.getElementById('btn-feedback')!.addEventListener('click', openFeedback);
document.getElementById('fb-github')!.addEventListener('click', () => {
  const { title, body } = currentReport();
  window.open(issueUrl(title, body, fbKind()), '_blank', 'noopener');
  fbStatus.textContent = 'Opened GitHub in a new tab. Check the report there and press Submit new issue.';
});
document.getElementById('fb-copy')!.addEventListener('click', async () => {
  const { title, body } = currentReport();
  try {
    await navigator.clipboard.writeText(`${title}

${body}`);
    fbStatus.textContent = 'Copied. Paste it into a message to the developer.';
  } catch {
    fbStatus.textContent = "This browser didn't allow copying. Select the text in the box and copy it by hand.";
  }
});
document.getElementById('fb-save')!.addEventListener('click', () => {
  if (!game) {
    fbStatus.textContent = 'There is no game to save yet.';
    return;
  }
  const url = URL.createObjectURL(new Blob([game.toJSON()], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `foundry-front-${VERSION}-save.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  fbStatus.textContent = 'Saved a copy of this game. Attach the file to your report.';
});

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
const artLoaded = loadArt(); // sprites appear as they finish loading; shapes are drawn until then


let last = performance.now();
let lastSeason: string | null = null;
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
  frameRate.frame(now);
  const world = active();
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  const guest = inMenu ? null : coop.guest;
  if (guest) ui.speed = guest.speed; // the host's speed, shown on the guest's screen too
  acc += elapsed * (inMenu ? 1 : ui.speed);
  let ticks = 0;
  if (guest) {
    // A guest runs only the ticks the host has run, and catches up when it falls behind. Paused, it
    // runs on to the host's tick, so both stop on the same one.
    while (ticks < MAX_TICKS_PER_FRAME && guest.canTick && (acc >= TICK || guest.ahead > CATCH_UP || guest.speed === 0)) {
      guest.tick();
      acc = Math.max(0, acc - TICK);
      ticks++;
    }
    if (!guest.canTick) acc = Math.min(acc, TICK); // waiting for the host: don't bank time to rush later
    guest.flush(now);
    // Out of step with the host, or far behind it: a fresh copy of the game is on its way (D-079).
    if (!guest.resyncing && guest.desyncedAt != null) console.warn(`Co-op: out of step with the host from tick ${guest.desyncedAt}.`);
    guest.checkHealth();
  } else {
    while (acc >= TICK && ticks < MAX_TICKS_PER_FRAME) {
      if (inMenu) world.tick(TICK);
      else if (coop.host) coop.host.tick();
      else if (session) session.tick();
      else world.tick(TICK);
      if (inMenu) sustainDemo(world);
      acc -= TICK;
      ticks++;
    }
    if (ticks === MAX_TICKS_PER_FRAME) acc = 0;
    if (!inMenu && coop.host) coop.host.flush(ui.speed, now);
  }
  if (inMenu && now - demoSince > DEMO_SCENE_MS) nextDemoScene();
  if (inMenu) {
    // Drift slowly around the demo factory.
    const hub = world.hub!;
    const t = now / 1000;
    camera.x = hub.x + HUB_SIZE / 2 + Math.sin(t * 0.07) * 6 + (window.innerWidth >= 600 ? -4 : 0);
    camera.y = hub.y + HUB_SIZE / 2 + Math.cos(t * 0.05) * 4 + (window.innerWidth < 600 ? 5 : 0);
  }
  // A new season brings its interlude (#42); not at the very start of a game.
  if (!inMenu) {
    const season = clockAt(world.state.time).season.id;
    if (lastSeason && season !== lastSeason) music.playNow(`season-${season}`);
    lastSeason = season;
  } else lastSeason = null;
  // Walking with the keys, the camera keeps the character in view (#40).
  const player = world.state.players.find((p) => p.id === ui.player);
  if (!inMenu && player && input.walkingByKeys) {
    const ease = Math.min(1, elapsed * 4);
    camera.x += (player.x - camera.x) * ease;
    camera.y += (player.y - camera.y) * ease;
  }
  camera.clampTo(world.state.width, world.state.height);
  renderer.draw(world, inMenu ? null : ui, now, Math.min(1, acc / TICK));
  planBar.update(world, !inMenu);
  if (!inMenu) {
    hud.update(world, now);
    hud.placeStock(world, camera);
    sounds.update(world, ui.speed > 0);
    critters.update(world.state.time, ui.speed > 0, now);
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
  /** Resolves once every sprite has loaded (or failed to). */
  artLoaded,
  /** The co-op room: its phase, this game's slot, and the lockstep (D-078). */
  coop,
  /** The scripted game the cross-browser determinism test runs (D-058). */
  runScenario,
};
