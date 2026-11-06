// The sound board (#214): sound effects in each version, side by side, with a pick and a note for each.
// Round 3: the five sounds no version has won get three new takes each (sfx-candidates.ts), beside the
// classic, enhanced and realistic versions. Every sound already picked plays as the game has it. Built
// into one HTML file by `npm run soundboard` (audio/soundboard.mjs); the game doesn't load it.

import { GAME_HUM, GAME_SOUNDS, Sfx, Sound, Variant } from './sfx';
import { CANDIDATES } from './sfx-candidates';

interface Entry {
  sound: Sound;
  name: string;
  what: string;
  /** Busy sounds: a burst plays it several times quickly, as in a fight. */
  burst?: boolean;
  /** No enhanced version to compare (split from a shared sound). */
  fresh?: boolean;
}

const OPEN: Entry[] = [
  { sound: 'shot', name: 'Hydraulic Turret', what: 'A turret driven by a shaft, firing iron plates, three a second', burst: true },
  { sound: 'zap', name: 'Tesla', what: 'Lightning that jumps from bug to bug', burst: true },
  { sound: 'rail', name: 'Railgun', what: 'A slug fired by magnets, through every bug in a line', fresh: true },
  { sound: 'hub_hit', name: 'Hub hit', what: 'Bugs bite the hub, or the engineer' },
  { sound: 'launch', name: 'Launch', what: 'The supply ship takes off' },
];

/** Every sound picked so far, as the game plays them. */
const PICKED: { sound: Sound; name: string }[] = [
  { sound: 'click', name: 'Click' },
  { sound: 'belt', name: 'Belt' },
  { sound: 'place', name: 'Place' },
  { sound: 'place_big', name: 'Place, big' },
  { sound: 'demolish', name: 'Demolish' },
  { sound: 'error', name: 'Error' },
  { sound: 'chop', name: 'Chop' },
  { sound: 'pick', name: 'Pick' },
  { sound: 'pick_done', name: 'Ore loose' },
  { sound: 'ping', name: 'Ping' },
  { sound: 'provoked', name: 'Provoked' },
  { sound: 'breach', name: 'Breach' },
  { sound: 'research', name: 'Research done' },
  { sound: 'stage', name: 'Ship stage' },
  { sound: 'gun', name: 'Turret Mk.2' },
  { sound: 'hub_shot', name: 'Hub gun' },
  { sound: 'twang', name: 'Ballista' },
  { sound: 'treb', name: 'Trebuchet' },
  { sound: 'cannon', name: 'Hydraulic Cannon' },
  { sound: 'mortar', name: 'Mortar' },
  { sound: 'artillery', name: 'Artillery' },
  { sound: 'death', name: 'Bug dies' },
  { sound: 'destroyed', name: 'Building lost' },
];

/** A version to play: one of the three made so far, or a round 3 take (its index). */
type Version = Variant | number;

const STORE_KEY = 'nestfall-soundboard-3';
const LETTER: Record<Variant, string> = { classic: 'A', enhanced: 'B', realistic: 'C' };
const LABEL: Record<Variant, string> = { classic: 'Classic', enhanced: 'Enhanced', realistic: 'Realistic' };

interface Saved {
  picks: Record<string, string>;
  notes: Record<string, string>;
}
function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<Saved>;
    return { picks: s.picks ?? {}, notes: s.notes ?? {} };
  } catch {
    return { picks: {}, notes: {} };
  }
}
function save(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(saved));
  } catch {
    // Picks just aren't remembered.
  }
}

const sfx: Record<Variant | 'game', Sfx> = {
  classic: new Sfx(0.7, 'classic'),
  enhanced: new Sfx(0.7, 'enhanced'),
  realistic: new Sfx(0.7, 'realistic'),
  game: new Sfx(0.7, 'game'),
};
const saved = load();
let humOn: Variant | 'game' | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function button(cls: string, text: string, onclick: () => void, title?: string): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.onclick = onclick;
  if (title) b.title = title;
  return b;
}

function playOnce(sound: Sound, v: Version, gain = 1, pan = 0): void {
  if (typeof v === 'number') {
    const c = CANDIDATES[sound]![v];
    sfx.realistic.play(sound, { gain: gain * (c.level ?? 1), pan, layers: c.layers() });
  } else sfx[v].play(sound, { gain, pan });
}

function play(sound: Sound, v: Version, burst = false): void {
  if (!burst) return playOnce(sound, v);
  for (let i = 0; i < 6; i++) setTimeout(() => playOnce(sound, v, 0.8 + Math.random() * 0.2, (Math.random() * 2 - 1) * 0.5), i * 170);
}

function length(sound: Sound): number {
  return sound === 'launch' ? 4200 : 900;
}

function versionName(v: Version, sound: Sound): string {
  return typeof v === 'number' ? `${v + 1} ${CANDIDATES[sound]![v].name}` : `${LETTER[v]} ${LABEL[v]}`;
}

function row(e: Entry): HTMLElement {
  const takes = CANDIDATES[e.sound] ?? [];
  const versions: Version[] = [...((e.fresh ? ['classic', 'realistic'] : ['classic', 'enhanced', 'realistic']) as Variant[]), ...takes.map((_, i) => i)];
  const r = el('div', 'row');
  const label = el('div', 'label');
  label.append(el('div', 'name', e.name), el('div', 'what', e.what));

  const old = el('div', 'btns');
  for (const v of versions.filter((x) => typeof x !== 'number')) old.append(button(`play ${v}`, LABEL[v as Variant], () => play(e.sound, v)));
  const fresh = el('div', 'takes');
  takes.forEach((c, i) => {
    const t = el('div', 'take');
    t.append(
      button('play new', `${i + 1} ${c.name}`, () => play(e.sound, i)),
      el('div', 'take-what', c.what),
    );
    fresh.append(t);
  });
  const extra = el('div', 'btns');
  extra.append(button('play run', 'All in turn', () => versions.forEach((v, i) => setTimeout(() => play(e.sound, v), i * length(e.sound)))));
  if (e.burst) {
    extra.append(button('play burst', 'Bursts ×6', () => versions.forEach((v, i) => setTimeout(() => play(e.sound, v, true), i * 1500)), 'Six quick plays of each version, as in a fight'));
  }

  const pick = el('div', 'pick');
  pick.setAttribute('role', 'radiogroup');
  pick.setAttribute('aria-label', `Your pick for ${e.name}`);
  const choices: [string, string][] = [...versions.map((v): [string, string] => [String(v), versionName(v, e.sound)]), ['none', 'None yet']];
  for (const [value, text] of choices) {
    const chip = button('chip', text, () => {
      saved.picks[e.sound] = value;
      save();
      pick.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
      summary();
    });
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(saved.picks[e.sound] === value));
    pick.append(chip);
  }
  const note = el('textarea', 'note');
  note.id = `note-${e.sound}`;
  note.placeholder = 'What’s off, or what you hear in your head (optional)';
  note.setAttribute('aria-label', `Notes on ${e.name}`);
  note.value = saved.notes[e.sound] ?? '';
  note.oninput = () => {
    saved.notes[e.sound] = note.value;
    save();
    summary();
  };
  r.append(label, old, fresh, extra, pick, note);
  return r;
}

function pickText(e: Entry): string {
  const p = saved.picks[e.sound];
  if (!p) return '—';
  if (p === 'none') return 'none yet';
  const n = Number(p);
  return Number.isInteger(n) ? versionName(n, e.sound) : versionName(p as Variant, e.sound);
}

function summary(): void {
  const done = OPEN.filter((e) => saved.picks[e.sound]).length;
  document.getElementById('count')!.textContent = `${done} of ${OPEN.length} picked`;
  const lines = OPEN.map((e) => {
    const note = (saved.notes[e.sound] ?? '').trim();
    return `${e.name}: ${pickText(e)}${note ? `\n  Note: ${note.replace(/\s+/g, ' ')}` : ''}`;
  });
  (document.getElementById('picks-text') as HTMLTextAreaElement).value = `Sound board picks, round 3 (#214)\n${lines.join('\n')}`;
}

function build(): void {
  const board = document.getElementById('board')!;
  const sec = el('section', 'group');
  sec.append(el('h2', undefined, 'Still open'));
  for (const e of OPEN) sec.append(row(e));
  board.append(sec);

  const done = el('section', 'group picked');
  done.append(el('h2', undefined, 'Picked, as the game plays them'));
  const grid = el('div', 'picked-grid');
  for (const p of PICKED) {
    const v = GAME_SOUNDS[p.sound] ?? 'classic';
    const b = button('play game', p.name, () => sfx.game.play(p.sound, { gain: 1 }));
    b.append(el('span', 'tag', LABEL[v]));
    grid.append(b);
  }
  const hum = button('play game', 'Factory hum', () => {
    humOn = humOn ? null : 'game';
    sfx.game.setHum(humOn ? 1 : 0);
    hum.setAttribute('aria-pressed', String(!!humOn));
  });
  hum.setAttribute('aria-pressed', 'false');
  hum.append(el('span', 'tag', `${LABEL[GAME_HUM]}, tap to stop`));
  grid.append(hum);
  done.append(grid);
  board.append(done);

  const vol = document.getElementById('volume') as HTMLInputElement;
  vol.oninput = () => {
    const v = Number(vol.value) / 100;
    for (const s of Object.values(sfx)) s.setVolume(v);
  };
  document.getElementById('copy')!.onclick = async () => {
    const t = document.getElementById('picks-text') as HTMLTextAreaElement;
    const msg = document.getElementById('copied')!;
    try {
      await navigator.clipboard.writeText(t.value);
      msg.textContent = 'Copied. Paste it into the chat.';
    } catch {
      t.select();
      msg.textContent = 'Selected. Copy it, then paste it into the chat.';
    }
  };
  summary();
}

build();
