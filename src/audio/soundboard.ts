// The sound board (#214): sound effects in each version, side by side, with a pick for each. Round 2: the
// sounds the owner didn't pick in round 1 get a realistic version, and each gun has its own sound. The
// sounds already picked play as the game has them. Built into one HTML file by `npm run soundboard`
// (audio/soundboard.mjs); the game doesn't load it.

import { GAME_SOUNDS, Sfx, Sound, Variant } from './sfx';

interface Entry {
  sound: Sound;
  name: string;
  what: string;
  /** Busy sounds: a burst plays it several times quickly, to hear how the repeats vary. */
  burst?: boolean;
  /** Split from a shared sound in round 2: there is no enhanced version to compare. */
  fresh?: boolean;
}

const ROUND2: { title: string; entries: Entry[] }[] = [
  {
    title: 'Guns',
    entries: [
      { sound: 'shot', name: 'Hydraulic Turret', what: 'A piston fires iron plates', burst: true },
      { sound: 'gun', name: 'Turret Mk.2', what: 'Bullets, fast. A was the Hydraulic Turret’s sound', burst: true, fresh: true },
      { sound: 'hub_shot', name: 'Hub gun', what: "The hub's own gun", burst: true },
      { sound: 'twang', name: 'Ballista', what: 'A bowstring and a bolt', burst: true },
      { sound: 'treb', name: 'Trebuchet', what: 'The arm swings and slams. A was the ballista’s sound', fresh: true },
      { sound: 'cannon', name: 'Hydraulic Cannon', what: 'Fires gears; they burst', burst: true },
      { sound: 'mortar', name: 'Mortar', what: 'A shell lobbed from a tube. A was the cannon’s sound', fresh: true, burst: true },
      { sound: 'artillery', name: 'Artillery', what: 'A big gun, far away. A was the cannon’s sound', fresh: true },
      { sound: 'zap', name: 'Tesla', what: 'Lightning that jumps between bugs', burst: true },
      { sound: 'rail', name: 'Railgun', what: 'A slug through everything. A was the tesla’s sound', fresh: true },
    ],
  },
  {
    title: 'Hits and losses',
    entries: [
      { sound: 'death', name: 'Bug dies', what: 'Its shell cracks', burst: true },
      { sound: 'destroyed', name: 'Building lost', what: 'Bugs break a building, or a strike lands', burst: true },
      { sound: 'hub_hit', name: 'Hub hit', what: 'Bugs bite the hub, or the engineer' },
    ],
  },
  {
    title: 'The ship',
    entries: [{ sound: 'launch', name: 'Launch', what: 'The supply ship takes off' }],
  },
];

/** Round 1's sounds, as the game plays them now. */
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
];

type Pick = Variant | 'either';
const PICKS_KEY = 'nestfall-soundboard-picks-2';
const LETTER: Record<Variant, string> = { classic: 'A', enhanced: 'B', realistic: 'C' };
const LABEL: Record<Variant, string> = { classic: 'Classic', enhanced: 'Enhanced', realistic: 'Realistic' };

function loadPicks(): Record<string, Pick> {
  try {
    return JSON.parse(localStorage.getItem(PICKS_KEY) ?? '{}') as Record<string, Pick>;
  } catch {
    return {};
  }
}
function savePicks(p: Record<string, Pick>): void {
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify(p));
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
const picks = loadPicks();
let humOn: Variant | null = null;

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

function play(style: Variant | 'game', sound: Sound, burst = false): void {
  const s = sfx[style];
  if (!burst) {
    s.play(sound, { gain: 1 });
    return;
  }
  for (let i = 0; i < 6; i++) setTimeout(() => s.play(sound, { gain: 0.8 + Math.random() * 0.2, pan: (Math.random() * 2 - 1) * 0.5 }), i * 170);
}

/** How long one play lasts, so the next in a run starts after it. */
function length(sound: Sound): number {
  return sound === 'launch' ? 4000 : sound === 'artillery' || sound === 'treb' ? 1500 : sound === 'destroyed' ? 1100 : 800;
}

function row(e: Entry): HTMLElement {
  const versions: Variant[] = e.fresh ? ['classic', 'realistic'] : ['classic', 'enhanced', 'realistic'];
  const r = el('div', 'row');
  const label = el('div', 'label');
  label.append(el('div', 'name', e.name), el('div', 'what', e.what));
  const btns = el('div', 'btns');
  for (const v of versions) btns.append(button(`play ${v}`, LABEL[v], () => play(v, e.sound)));
  btns.append(button('play run', 'All in turn', () => versions.forEach((v, i) => setTimeout(() => play(v, e.sound), i * length(e.sound))), versions.map((v) => LETTER[v]).join(', then ')));
  if (e.burst) {
    btns.append(button('play burst', 'Burst ×6', () => versions.forEach((v, i) => setTimeout(() => play(v, e.sound, true), i * 1500)), 'Six quick plays of each version, as in a fight'));
  }
  const pick = el('div', 'pick');
  pick.setAttribute('role', 'radiogroup');
  pick.setAttribute('aria-label', `Your pick for ${e.name}`);
  for (const v of [...versions, 'either'] as Pick[]) {
    const chip = button('chip', v === 'either' ? 'Either' : `${LETTER[v]} ${LABEL[v]}`, () => {
      picks[e.sound] = v;
      savePicks(picks);
      pick.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
      summary();
    });
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(picks[e.sound] === v));
    pick.append(chip);
  }
  r.append(label, btns, pick);
  return r;
}

function summary(): void {
  const all = ROUND2.flatMap((g) => g.entries);
  const hum = picks.hum ? 1 : 0;
  const done = all.filter((e) => picks[e.sound]).length + hum;
  document.getElementById('count')!.textContent = `${done} of ${all.length + 1} picked`;
  const lines = all.map((e) => `${e.name}: ${picks[e.sound] ?? '—'}`);
  lines.push(`Factory hum: ${picks.hum ?? '—'}`);
  (document.getElementById('picks-text') as HTMLTextAreaElement).value = `Sound board picks, round 2 (#214)\n${lines.join('\n')}`;
}

function humRow(): HTMLElement {
  const r = el('div', 'row');
  const label = el('div', 'label');
  label.append(el('div', 'name', 'Factory hum'), el('div', 'what', 'The loop under a busy factory. Tap again to stop'));
  const btns = el('div', 'btns');
  for (const v of ['classic', 'enhanced'] as Variant[]) {
    const b = button(`play ${v}`, `${LABEL[v]} hum`, () => {
      humOn = humOn === v ? null : v;
      sfx.classic.setHum(humOn === 'classic' ? 1 : 0);
      sfx.enhanced.setHum(humOn === 'enhanced' ? 1 : 0);
      btns.querySelectorAll('[data-hum]').forEach((x) => x.setAttribute('aria-pressed', String(x.getAttribute('data-hum') === humOn)));
    });
    b.dataset.hum = v;
    b.setAttribute('aria-pressed', 'false');
    btns.append(b);
  }
  const pick = el('div', 'pick');
  for (const v of ['classic', 'enhanced', 'either'] as Pick[]) {
    const chip = button('chip', v === 'either' ? 'Either' : `${LETTER[v]} ${LABEL[v]}`, () => {
      picks.hum = v;
      savePicks(picks);
      pick.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
      summary();
    });
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', String(picks.hum === v));
    pick.append(chip);
  }
  r.append(label, btns, pick);
  return r;
}

function build(): void {
  const board = document.getElementById('board')!;
  for (const g of ROUND2) {
    const sec = el('section', 'group');
    sec.append(el('h2', undefined, g.title));
    for (const e of g.entries) sec.append(row(e));
    board.append(sec);
  }
  const hum = el('section', 'group');
  hum.append(el('h2', undefined, 'Machine hum'), humRow());
  board.append(hum);

  const done = el('section', 'group picked');
  done.append(el('h2', undefined, 'Picked in round 1, as the game plays them'));
  const grid = el('div', 'picked-grid');
  for (const p of PICKED) {
    const v = GAME_SOUNDS[p.sound] ?? 'classic';
    const b = button('play game', `${p.name}`, () => play('game', p.sound));
    b.append(el('span', 'tag', LABEL[v]));
    grid.append(b);
  }
  done.append(grid);
  board.append(done);

  const vol = document.getElementById('volume') as HTMLInputElement;
  vol.oninput = () => {
    const v = Number(vol.value) / 100;
    for (const s of Object.values(sfx)) s.setVolume(v);
  };
  document.getElementById('copy')!.onclick = async () => {
    const t = document.getElementById('picks-text') as HTMLTextAreaElement;
    const note = document.getElementById('copied')!;
    try {
      await navigator.clipboard.writeText(t.value);
      note.textContent = 'Copied. Paste it into the chat.';
    } catch {
      t.select();
      note.textContent = 'Selected. Copy it, then paste it into the chat.';
    }
  };
  summary();
}

build();
