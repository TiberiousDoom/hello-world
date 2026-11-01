// "Gaps" board: animations that sprites like these already have: the greenhouse working, the wasp and beetle
// walking and attacking, the five guns that fire without moving, and young bugs drawn as their own sprites.
// node docs/art-canvas/ideas/gaps.mjs [repo] [out]
import { read, swap, over, make, inner, box, idea, still, play, frames, board, INK } from './lib.mjs';

const TAU = Math.PI * 2;
const f1 = (n) => n.toFixed(1);

// --- Greenhouse: the saplings sway, sprinklers mist across them, and the grow light breathes.
const greenhouse = (() => {
  const base = read('buildings/greenhouse');
  const plants = [
    [34, 36, 12], [64, 32, 10], [94, 38, 12],
    [36, 70, 10], [66, 66, 13], [94, 72, 10],
    [34, 98, 9], [64, 98, 11], [94, 100, 9],
  ];
  const leafStart = '<g fill="#3f8f4f" stroke="#1f4a28" stroke-width="2">';
  const a = base.indexOf(leafStart);
  const b = base.indexOf('</g>', base.indexOf('<g fill="#6cbf5a">')) + 4;
  return [0, 1, 2, 3].map((i) => {
    const ph = (i / 4) * TAU;
    let leaves = leafStart;
    let lights = '<g fill="#6cbf5a">';
    plants.forEach(([x, y, r], k) => {
      const dx = 1.6 * Math.sin(ph + (k % 3) * 1.1 + Math.floor(k / 3) * 0.7);
      const rr = r * (1 + 0.05 * Math.sin(ph + k));
      leaves += `<circle cx="${f1(x + dx)}" cy="${y}" r="${f1(rr)}" />`;
      lights += `<circle cx="${f1(x + dx - rr * 0.28)}" cy="${f1(y - rr * 0.28)}" r="${f1(rr * 0.34)}" />`;
    });
    leaves += '</g>' + lights + '</g>';
    let s = base.slice(0, a) + leaves + base.slice(b);
    // A warm glow under the glass, brightest on frame 2.
    const glow = [0.1, 0.22, 0.14, 0.06][i];
    s = swap(s, '<rect x="12" y="12" width="104" height="104" rx="6" fill="url(#ghGlass)"', `<rect x="12" y="12" width="104" height="104" rx="6" fill="#ffd36b" opacity="${glow}" /><rect x="12" y="12" width="104" height="104" rx="6" fill="url(#ghGlass)"`, 'greenhouse glow');
    // Mist from the two crossbars, drifting down a row each frame.
    let mist = '<g fill="#e8f8ff">';
    for (const bar of [46, 82]) for (const x of [24, 40, 56, 72, 88, 104]) {
      const d = 3 + ((i * 4 + x / 8) % 12);
      mist += `<circle cx="${x + ((x / 8) % 3) - 1}" cy="${f1(bar + d)}" r="${f1(2.4 - d / 10)}" opacity="${f1(1 - d / 18)}" />`;
    }
    mist += '</g>';
    return over(s, mist + `<circle cx="112" cy="65" r="${[5, 7, 5, 4][i]}" fill="#3fa9f5" opacity="${[0.25, 0.4, 0.25, 0.15][i]}" />`);
  });
})();

// --- Wasp: a 4-frame wingbeat (the wings sweep and blur) and a 4-frame sting.
const waspBase = read('enemies/wasp');
const WINGS = '<g fill="#dff2ff" fill-opacity="0.55" stroke="#0f1a2e" stroke-width="1.2"><path d="M34 28 Q30 6 44 4 Q50 10 38 28 Z" /><path d="M34 36 Q30 58 44 60 Q50 54 38 36 Z" /><path d="M32 28 Q20 12 26 8 Q34 12 36 28 Z" /><path d="M32 36 Q20 52 26 56 Q34 52 36 36 Z" /></g>';
function wings(a, s, blur) {
  // Upper wings turn about their root at (35, 28), lower ones mirrored about (35, 36); s shortens them as they rise.
  const w = (d, rx, ry, sign) => `<path d="${d}" transform="translate(${rx} ${ry}) rotate(${sign * a}) scale(1 ${s}) translate(${-rx} ${-ry})" />`;
  const set = (op) =>
    `<g fill="#dff2ff" fill-opacity="${op}" stroke="#0f1a2e" stroke-width="1.2" stroke-opacity="${op > 0.3 ? 1 : 0.3}">` +
    w('M34 28 Q30 6 44 4 Q50 10 38 28 Z', 35, 28, 1) + w('M34 36 Q30 58 44 60 Q50 54 38 36 Z', 35, 36, -1) +
    w('M32 28 Q20 12 26 8 Q34 12 36 28 Z', 34, 28, 1) + w('M32 36 Q20 52 26 56 Q34 52 36 36 Z', 34, 36, -1) + '</g>';
  return blur ? set(0.18).replace('<g ', `<g transform="translate(0 0)" `) + set(0.45) : set(0.55);
}
const waspFly = [
  [-16, 1, false], [0, 0.72, true], [16, 0.5, true], [2, 0.8, false],
].map(([a, s, blur]) => swap(waspBase, WINGS, wings(a, s, blur), 'wasp wings'));
const ABDOMEN_START = '<path d="M4 32 L10 30 L10 34 Z"';
const waspSting = [
  [1, 0, 0.8],
  [0.86, 0, 0.7],
  [1.14, 3, 0.6],
  [1, 1, 0.75],
].map(([sx, drip, s], i) => {
  let w = swap(waspBase, WINGS, wings(-6, s, false), 'wasp wings');
  // The abdomen and stinger, from the stinger to the stripes, pull back and stab forward about the waist (x 31).
  const a = w.indexOf(ABDOMEN_START);
  const b = w.indexOf('</g>', w.indexOf('<g fill="#1a1408"><rect')) + 4;
  const part = w.slice(a, b);
  w = w.slice(0, a) + `<g transform="translate(31 32) scale(${sx} ${2 - sx > 1 ? 1 : 2 - sx}) translate(-31 -32)">${part}</g>` + w.slice(b);
  if (i === 2) w = over(w, `<path d="M${f1(31 - 27 * sx)} 32 l-3 0" stroke="#fff3c4" stroke-width="1.2" stroke-linecap="round" /><circle cx="${f1(31 - 27 * sx - 4)}" cy="32" r="1.6" fill="#a8f06a" stroke="${INK}" stroke-width="0.6" />`);
  if (drip && i === 3) w = over(w, `<circle cx="${f1(31 - 27 * sx - 2)}" cy="34.5" r="1.2" fill="#a8f06a" opacity="0.8" />`);
  return w;
});

// --- Beetle: a tripod gait (three legs move while the other three hold) and a mandible snap.
const beetleBase = read('enemies/beetle');
const LEGS = 'M22 17 L19 11 L13 7 M32 16 L33 9 L30 4 M41 22 L46 16 L51 12 M22 47 L19 53 L13 57 M32 48 L33 55 L30 60 M41 42 L46 48 L51 52';
const legList = [
  [[22, 17], [19, 11], [13, 7], 'A'], [[32, 16], [33, 9], [30, 4], 'B'], [[41, 22], [46, 16], [51, 12], 'A'],
  [[22, 47], [19, 53], [13, 57], 'B'], [[32, 48], [33, 55], [30, 60], 'A'], [[41, 42], [46, 48], [51, 52], 'B'],
];
const legs = (phase) =>
  legList
    .map(([h, k, f, set]) => {
      const dx = (set === 'A' ? 1 : -1) * 3.2 * Math.sin(phase);
      return `M${h[0]} ${h[1]} L${f1(k[0] + dx * 0.55)} ${k[1]} L${f1(f[0] + dx)} ${f[1]}`;
    })
    .join(' ');
const beetleWalk = [0, 1, 2, 3].map((i) => beetleBase.split(LEGS).join(legs((i / 4) * TAU + Math.PI / 2)));
const MANDIBLES = '<path d="M56 28 Q61.5 25.5 62.5 29.5 Q60 29 57.5 30.5 M56 36 Q61.5 38.5 62.5 34.5 Q60 35 57.5 33.5" fill="#2a2f3c" stroke="#0f1a2e" stroke-width="1.4" stroke-linejoin="round" />';
const beetleBite = [
  [18, 0], [32, -1.2], [-4, 2.4], [6, 1],
].map(([open, lunge]) => {
  const m = (d, cx, cy, a) => `<path d="${d}" transform="rotate(${a} ${cx} ${cy})" fill="#2a2f3c" stroke="#0f1a2e" stroke-width="1.4" stroke-linejoin="round" />`;
  let s = swap(beetleBase, MANDIBLES, m('M56 28 Q61.5 25.5 62.5 29.5 Q60 29 57.5 30.5', 56.5, 29.5, -open) + m('M56 36 Q61.5 38.5 62.5 34.5 Q60 35 57.5 33.5', 56.5, 34.5, open), 'beetle mandibles');
  s = swap(s, '<!-- Armoured collar, head and mandibles -->', `<g transform="translate(${lunge} 0)">`, 'beetle head');
  return s.replace(/<\/svg>\s*$/, '</g></svg>');
});

// --- Guns: the barrel kicks back under the turret head and eases out again, with a puff of smoke.
/** Wraps each top-level element of the sprite that `isTube` picks in a group moved by `dx`. */
function recoil(svg, isTube, dx) {
  const vb = box(svg);
  const body = inner(svg);
  const defs = body.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? '';
  const rest = body.replace(defs, '');
  // Top-level elements, keeping a <g>…</g> block whole.
  const parts = [];
  const re = /<g\b[^>]*>[\s\S]*?<\/g>|<[a-z]+\b[^>]*\/>/g;
  let m;
  while ((m = re.exec(rest))) parts.push(m[0]);
  const moved = parts.map((p) => (isTube(p) ? `<g transform="translate(${f1(dx)} 0)">${p}</g>` : p)).join('');
  return make(vb, defs + moved);
}
const first = (p) => {
  const m = p.match(/\b(?:x|cx)="([\d.]+)"|d="M\s*([\d.]+)/);
  return m ? Number(m[1] ?? m[2]) : 0;
};
const puff = (x, y, k, scale) =>
  k === 0
    ? ''
    : `<g opacity="${f1(0.75 - k * 0.17)}">${[0, 1, 2]
        .map((j) => `<circle cx="${f1(x - scale * (1 + k * 1.5 + j * 1.5))}" cy="${f1(y - scale * (1 + k * 2) + scale * (j - 1) * 1.5)}" r="${f1(scale * (1.2 + k * 0.7))}" fill="#dfe4ea" />`)
        .join('')}</g>`;
const GUNS = [
  ['turret', 'Turret', (p) => first(p) >= 34 && !p.startsWith('<circle'), 4, [[61, 27], [61, 37]], 1],
  ['turret2', 'Turret Mk.2', (p) => first(p) >= 34 && !p.startsWith('<circle'), 3, [[61, 30], [61, 34]], 1],
  ['cannon', 'Cannon', (p) => first(p) >= 34 && !p.startsWith('<circle') && !p.startsWith('<ellipse cx="28'), 6, [[62, 32]], 1.2],
  ['mortar', 'Mortar', (p) => first(p) >= 30 && !p.startsWith('<circle') && !p.startsWith('<g'), 3.5, [[57, 32]], 1.3],
  ['artillery', 'Artillery', (p) => first(p) >= 58, 11, [[124, 64]], 2.6],
];
const KICK = [1, 0.62, 0.32, 0.12, 0];
const guns = GUNS.map(([key, name, isTube, d, muzzles, sc]) => {
  const still = read(`buildings/${key}_barrel`);
  const base = read(`buildings/${key}_base`);
  const fr = KICK.map((k, i) => over(recoil(still, isTube, -d * k), muzzles.map(([x, y]) => puff(x - d * k, y, i, sc)).join('')));
  // Shown on its base, as in the game.
  const onBase = (top) => make(box(base), inner(base) + `<svg viewBox="${box(top)}" width="${box(base).split(' ')[2]}" height="${box(base).split(' ')[3]}">${inner(top)}</svg>`);
  return { key, name, still: onBase(still), frames: fr.map(onBase) };
});

// --- Young bugs: drawn as their own sprites, pale like a fresh moult, darkening as they grow.
const pale = (svg, k, id) =>
  make(
    box(svg),
    `<defs><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${1 - k} 0 0 0 ${f1(0.94 * k * 10) / 10}  0 ${1 - k} 0 0 ${f1(0.86 * k * 10) / 10}  0 0 ${1 - k} 0 ${f1(0.7 * k * 10) / 10}  0 0 0 1 0" /></filter></defs><g filter="url(#${id})">${inner(svg)}</g>`,
  );
const dull = (svg, id) =>
  make(box(svg), `<defs><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0.55" /><feComponentTransfer><feFuncR type="linear" slope="0.8" /><feFuncG type="linear" slope="0.8" /><feFuncB type="linear" slope="0.8" /></feComponentTransfer></filter></defs><g filter="url(#${id})">${inner(svg)}</g>`);
/** A sprite drawn at a fraction of its size, centred in its own frame. */
const shrink = (svg, k) => {
  const [, , w, h] = box(svg).split(' ').map(Number);
  return make(box(svg), `<g transform="translate(${f1((w * (1 - k)) / 2)} ${f1((h * (1 - k)) / 2)}) scale(${k})">${inner(svg)}</g>`);
};
const young = ['crawler', 'runner', 'brute'].map((kind) => {
  const adult = read(`enemies/${kind}`);
  return {
    kind,
    now: shrink(dull(adult, `d${kind}`), 0.6),
    stages: [
      shrink(pale(adult, 0.62, `p1${kind}`), 0.45),
      shrink(pale(adult, 0.34, `p2${kind}`), 0.62),
      shrink(pale(adult, 0.12, `p3${kind}`), 0.8),
      adult,
    ],
  };
});

const big = 150;
board('IdeasGaps.dc.html', {
  title: 'Ideas · Gaps',
  kicker: 'Ideas · proposed, not in the game',
  heading: 'Filling the gaps',
  intro:
    'Things that other sprites like them already have. Each idea shows the sprite as the game draws it now, the new frames, and the frames played at the speed the game would play them. All of them are built from the game\'s own sprites, the way <code>art/working.mjs</code> and <code>art/animate.mjs</code> build the working and firing strips today.',
  ideas: [
    idea(
      'Greenhouse working',
      'The only machine with no working animation. The saplings sway, mist drifts down from the two crossbars, the grow light warms under the glass, and the power light by the input pulses.',
      [['Now', still(read('buildings/greenhouse'), 120)], ['4 frames', frames(greenhouse, 96)], ['Played', play(greenhouse, 6, big)]],
      'buildings/greenhouse_working_4f',
    ),
    idea(
      'Wasp: wingbeat and sting',
      'The wasp still swaps two still sprites. Flying: the wings sweep forward and back, shortening and blurring as they beat. Attacking: the abdomen draws back and stabs forward, and a drop of green venom shows on the strike.',
      [
        [['Now', still(waspBase, 84)], ['Fly · 4 frames', frames(waspFly, 84)], ['Played', play(waspFly, 16, 130)]],
        [['', still(waspBase, 84).replace('<div style="background', '<div style="visibility: hidden; background')], ['Sting · 4 frames', frames(waspSting, 84)], ['Played', play(waspSting, 8, 130)]],
      ],
      'enemies/wasp_walk_4f, wasp_attack_4f',
    ),
    idea(
      'Beetle: walk and bite',
      'A tripod gait: three legs swing forward while the other three hold, then they trade. Biting: the mandibles spread wide, the head pulls back, then lunges and snaps shut.',
      [
        [['Now', still(beetleBase, 84)], ['Walk · 4 frames', frames(beetleWalk, 84)], ['Played', play(beetleWalk, 8, 130)]],
        [['', still(beetleBase, 84).replace('<div style="background', '<div style="visibility: hidden; background')], ['Bite · 4 frames', frames(beetleBite, 84)], ['Played', play(beetleBite, 8, 130)]],
      ],
      'enemies/beetle_walk_4f, beetle_attack_4f',
    ),
    idea(
      'Guns that recoil',
      'Only the ballista and trebuchet move when they fire. Here each gun\'s barrel kicks back under its head and eases out over five frames, with a wisp of smoke at the muzzle (the bigger the gun, the harder the kick). The muzzle flash the game draws now stays on top. Each is shown on its base, as in the game.',
      guns.map((g) => [[g.name, still(g.still, 104)], ['5 frames', frames(g.frames, 104)], ['Played, with a pause between shots', play([...g.frames, ...Array(5).fill(g.frames[4])], 12, 140)]]),
      'buildings/turret_barrel_fire_5f and the same for turret2, cannon, mortar, artillery',
    ),
    idea(
      'Young bugs as their own sprites',
      'Now a young bug is the adult drawn at 60%, duller and darker. Instead, young bugs could be pale, like an insect fresh from a moult, and colour up as they grow: hatchling, young, nearly grown, then the adult.',
      young.map((y) => [[`Now · young ${y.kind}`, still(y.now, 96)], ['Growing up', frames(y.stages, 96)]]),
      'enemies/crawler_young, runner_young, brute_young (and in-between stages if wanted)',
    ),
  ],
});
