// Queen bugs (D-152), drawn from scratch. Each faces right like the workers, in a 96-unit box, lit from
// the top left with one ink outline. What makes a queen is the body, not a crown: like real termite,
// oil-beetle and wasp queens, she is swollen with eggs. Her armour plates have spread apart over a pale,
// stretched abdomen, with eggs showing through it.

const INK = '#0f1a2e';
const f = (n) => Math.round(n * 10) / 10;

/** A leg: ink first, then its colour, through the given joints. */
function leg(points, w, color) {
  const d = 'M' + points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L');
  return (
    `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 1.8}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/** A pair of legs, mirrored about the body's centre line (y = 48). */
const legs = (points, w, color) =>
  leg(points, w, color) +
  leg(
    points.map(([x, y]) => [x, 96 - y]),
    w,
    color,
  );

/** An antenna: a thin curve, mirrored. */
function antennae(d, color, w = 1.3) {
  const m = d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${x} ${f(96 - +y)}`);
  return [d, m].map((p) => `<path d="${p}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`).join('');
}

/** Eggs showing through a stretched abdomen: faint pale ovals at fixed spots. */
function eggsInside(cx, cy, rx, ry, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = i * 2.4,
      d = Math.sqrt((i + 0.5) / n) * 0.75;
    s += `<ellipse cx="${f(cx + Math.cos(a) * rx * d)}" cy="${f(cy + Math.sin(a) * ry * d)}" rx="2.6" ry="1.9" fill="#fffaf0" opacity="0.4"/>`;
  }
  return s;
}

/** The pale stretched abdomen every queen has, with its gloss. */
function belly(p, cx, cy, rx, ry) {
  return (
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${p}belly)" stroke="${INK}" stroke-width="2"/>` +
    eggsInside(cx, cy, rx, ry, 14) +
    `<path d="M${f(cx - rx * 0.75)} ${f(cy - ry * 0.4)} Q${f(cx - rx * 0.2)} ${f(cy - ry * 0.95)} ${f(cx + rx * 0.45)} ${f(cy - ry * 0.7)}" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="2.4" stroke-linecap="round"/>`
  );
}

/** Armour plates spread across an abdomen: each a band across it, with a lit top edge. */
function plates(p, cx, cy, rx, ry, xs, w, fill, hk = 0.66) {
  let s = '';
  for (const t of xs) {
    const x = cx + rx * t;
    const h = ry * Math.sqrt(Math.max(0, 1 - t * t)) * hk;
    s += `<rect x="${f(x - w / 2)}" y="${f(cy - h)}" width="${w}" height="${f(2 * h)}" rx="${f(w / 2)}" fill="${fill}" stroke="${INK}" stroke-width="1.4"/>`;
    s += `<path d="M${f(x - w / 4)} ${f(cy - h + 3)} L${f(x - w / 4)} ${f(cy - h * 0.2)}" stroke="#fff" stroke-opacity="0.45" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  return s;
}

const shadow = (p, cx, rx, ry) => `<ellipse cx="${cx + 2}" cy="51" rx="${rx}" ry="${ry}" fill="#000" opacity="0.3" filter="url(#${p}soft)"/>`;

function defs(p, belly0, belly1, belly2, extra = '') {
  return `<defs>
<filter id="${p}soft" filterUnits="userSpaceOnUse" x="0" y="0" width="96" height="96"><feGaussianBlur stdDeviation="2"/></filter>
<radialGradient id="${p}belly" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="${belly0}"/><stop offset="0.6" stop-color="${belly1}"/><stop offset="1" stop-color="${belly2}"/></radialGradient>
${extra}</defs>`;
}

// ---------------------------------------------------------------------------------------------------
// Crawler queen: a termite queen. A huge cream abdomen with the orange back plates spread far apart,
// a small crawler's front end, and a little brood of eggs at her tail.
// ---------------------------------------------------------------------------------------------------
function crawler() {
  const p = 'qcr';
  let s = defs(
    p,
    '#fff4e0',
    '#ecd2a6',
    '#a8845a',
    `<linearGradient id="${p}seg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f09048"/><stop offset="0.5" stop-color="#c8682c"/><stop offset="1" stop-color="#7a3410"/></linearGradient>
<linearGradient id="${p}head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a04a18"/><stop offset="1" stop-color="#4a1c06"/></linearGradient>`,
  );
  s += shadow(p, 46, 42, 19);
  // Six short legs at the front: she can barely carry herself.
  s += legs(
    [
      [64, 42],
      [62, 32],
      [56, 27],
    ],
    2.2,
    '#7a3410',
  );
  s += legs(
    [
      [70, 42],
      [72, 32],
      [70, 25],
    ],
    2.2,
    '#7a3410',
  );
  s += legs(
    [
      [76, 43],
      [82, 34],
      [86, 30],
    ],
    2.2,
    '#7a3410',
  );
  s += belly(p, 34, 48, 30, 21);
  s += plates(p, 34, 48, 30, 21, [-0.72, -0.36, 0, 0.36, 0.7], 4.5, `url(#${p}seg)`);
  // Thorax and head.
  s += `<g fill="url(#${p}seg)" stroke="${INK}" stroke-width="1.6"><rect x="60" y="40" width="8" height="16" rx="3.5"/><rect x="66" y="41" width="8" height="14" rx="3.5"/><rect x="72" y="42" width="7" height="12" rx="3"/></g>`;
  s += antennae('M86 45 Q91 40 94 33', '#7a3410');
  s += `<rect x="77" y="41" width="11" height="14" rx="5" fill="url(#${p}head)" stroke="${INK}" stroke-width="1.6"/>`;
  s += `<path d="M87 45 l4 1 M87 51 l4 -1" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
  s += `<circle cx="84" cy="44.5" r="1.6" fill="#ffd860" stroke="${INK}" stroke-width="0.6"/><circle cx="84" cy="51.5" r="1.6" fill="#ffd860" stroke="${INK}" stroke-width="0.6"/>`;
  s += `<path d="M62 42 L66 42 M68 43 L72 43" stroke="#fff" stroke-opacity="0.45" stroke-width="1.2" stroke-linecap="round"/>`;
  // Eggs just laid behind her.
  for (const [x, y] of [
    [4, 44],
    [6, 52],
    [9, 47],
  ])
    s += `<ellipse cx="${x}" cy="${y}" rx="2.8" ry="2" fill="#fff4e0" stroke="${INK}" stroke-width="0.8"/>`;
  return s;
}

// ---------------------------------------------------------------------------------------------------
// Runner queen: a centipede curled in a gentle S, her middle segments swollen so the navy plates stand
// apart on a pale body; many legs, long feelers and a pair of tail prongs.
// ---------------------------------------------------------------------------------------------------
function runner() {
  const p = 'qrn';
  let s = defs(
    p,
    '#e8ecf8',
    '#b4bcd4',
    '#6a7290',
    `<linearGradient id="${p}seg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6480"/><stop offset="0.5" stop-color="#2a3044"/><stop offset="1" stop-color="#141824"/></linearGradient>`,
  );
  const n = 12;
  const at = (i) => {
    const x = 12 + i * 6.6;
    const y = 48 + Math.sin(i / 3.2 + 0.6) * 3;
    // Thin at both ends, swollen through the middle and back.
    const t = i / (n - 1);
    const h = 5 + 11 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.9;
    return [x, y, h];
  };
  s += shadow(p, 50, 40, 15);
  // Legs: a pair per segment, swept back.
  for (let i = 0; i < n; i++) {
    const [x, y, h] = at(i);
    for (const side of [-1, 1])
      s += leg(
        [
          [x, y + side * h * 0.6],
          [x + 1, y + side * (h + 4)],
          [x - 3, y + side * (h + 9)],
        ],
        1.4,
        '#3b4152',
      );
  }
  // Tail prongs.
  s +=
    leg(
      [
        [13, 46],
        [7, 41],
        [2, 40],
      ],
      1.6,
      '#2a3044',
    ) +
    leg(
      [
        [13, 51],
        [7, 56],
        [2, 57],
      ],
      1.6,
      '#2a3044',
    );
  // The pale body under the plates, then the plates.
  let top = '',
    bottom = '';
  for (let i = 0; i < n; i++) {
    const [x, y, h] = at(i);
    top += `${i ? ' L' : 'M'}${f(x)} ${f(y - h)}`;
    bottom = ` L${f(x)} ${f(y + h)}` + bottom;
  }
  s += `<path d="${top}${bottom} Z" fill="url(#${p}belly)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
  for (let i = 0; i < n; i++) {
    const [x, y, h] = at(i);
    const w = 4.2;
    s += `<rect x="${f(x - w / 2)}" y="${f(y - h * 0.7)}" width="${w}" height="${f(2 * h * 0.7)}" rx="2" fill="url(#${p}seg)" stroke="${INK}" stroke-width="1"/>`;
    if (h > 9) s += `<ellipse cx="${f(x + 2.6)}" cy="${f(y + (i % 2 ? 3 : -3))}" rx="1.3" ry="1.8" fill="#fffaf0" opacity="0.5"/>`;
  }
  s += `<path d="M20 ${f(at(1)[1] - at(1)[2] + 2)} Q46 ${f(at(5)[1] - at(5)[2] - 1)} 76 ${f(at(9)[1] - at(9)[2] + 3)}" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1.6" stroke-linecap="round"/>`;
  // Head, fangs and feelers.
  s += antennae('M90 45 Q95 40 94 30 Q93 24 89 20', '#3b4152', 1.2);
  s += `<path d="M90 44 Q95 44 94 48 M90 52 Q95 52 94 48" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
  s += `<ellipse cx="88" cy="48" rx="5" ry="5.5" fill="url(#${p}seg)" stroke="${INK}" stroke-width="1.4"/>`;
  s += `<circle cx="90" cy="45.5" r="1.1" fill="#ff8a3c"/><circle cx="90" cy="50.5" r="1.1" fill="#ff8a3c"/>`;
  return s;
}

// ---------------------------------------------------------------------------------------------------
// Wasp queen: a big wasp at rest, wings folded flat along her back over a long, heavy striped abdomen.
// ---------------------------------------------------------------------------------------------------
function wasp() {
  const p = 'qws';
  let s = defs(
    p,
    '#fff0a0',
    '#f2c14e',
    '#a87010',
    `<radialGradient id="${p}thorax" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#6a5630"/><stop offset="1" stop-color="#1a1408"/></radialGradient>
<clipPath id="${p}clip"><path d="M6 48 C10 34 26 30 44 36 C50 39 52 44 52 48 C52 52 50 57 44 60 C26 66 10 62 6 48 Z"/></clipPath>`,
  );
  s += shadow(p, 46, 42, 17);
  // Legs: dark, with yellow feet.
  s += legs(
    [
      [58, 42],
      [56, 30],
      [50, 24],
      [48, 22],
    ],
    1.8,
    '#2a2010',
  );
  s += legs(
    [
      [62, 42],
      [66, 30],
      [66, 23],
    ],
    1.8,
    '#2a2010',
  );
  s += legs(
    [
      [66, 43],
      [74, 33],
      [80, 29],
    ],
    1.8,
    '#2a2010',
  );
  for (const [x, y] of [
    [48, 22],
    [66, 23],
    [80, 29],
  ])
    s += `<circle cx="${x}" cy="${y}" r="1.3" fill="#f2c14e"/><circle cx="${x}" cy="${96 - y}" r="1.3" fill="#f2c14e"/>`;
  // Stinger, then the abdomen with its bands (clipped to its outline).
  s += `<path d="M7 48 L0 48" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
  s += `<path d="M6 48 C10 34 26 30 44 36 C50 39 52 44 52 48 C52 52 50 57 44 60 C26 66 10 62 6 48 Z" fill="url(#${p}belly)"/>`;
  s += `<g clip-path="url(#${p}clip)" fill="#1a1408">`;
  for (const x of [12, 22, 32, 42]) s += `<path d="M${x} 20 Q${x - 4} 48 ${x} 76 L${x + 5} 76 Q${x + 1} 48 ${x + 5} 20 Z"/>`;
  s += `</g>` + eggsInside(30, 48, 18, 10, 6);
  s += `<path d="M6 48 C10 34 26 30 44 36 C50 39 52 44 52 48 C52 52 50 57 44 60 C26 66 10 62 6 48 Z" fill="none" stroke="${INK}" stroke-width="2"/>`;
  s += `<path d="M14 40 Q26 33 40 37" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round"/>`;
  // Waist, thorax with yellow marks.
  s += `<ellipse cx="54" cy="48" rx="3" ry="3.5" fill="#1a1408" stroke="${INK}" stroke-width="1.2"/>`;
  s += `<ellipse cx="63" cy="48" rx="9.5" ry="9" fill="url(#${p}thorax)" stroke="${INK}" stroke-width="1.8"/>`;
  s += `<path d="M58 42 Q63 40 68 42 M58 54 Q63 56 68 54" fill="none" stroke="#f2c14e" stroke-width="1.8" stroke-linecap="round"/>`;
  // Wings folded back flat over the abdomen: two each side, overlapping.
  for (const side of [-1, 1]) {
    const y = 48 + side * 4;
    s += `<path d="M62 ${y} Q42 ${y + side * 18} 14 ${y + side * 9} Q36 ${y - side * 2} 62 ${y} Z" fill="#eef8ff" fill-opacity="0.6" stroke="${INK}" stroke-width="1"/>`;
    s += `<path d="M62 ${y} Q46 ${y + side * 10} 24 ${y + side * 5} Q42 ${y - side * 3} 62 ${y} Z" fill="#eef8ff" fill-opacity="0.45" stroke="${INK}" stroke-width="0.8"/>`;
    s += `<path d="M58 ${y + side * 1} Q40 ${y + side * 9} 20 ${y + side * 7}" fill="none" stroke="${INK}" stroke-opacity="0.35" stroke-width="0.6"/>`;
  }
  // Head: big red eyes on the sides, yellow face, jaws, elbowed feelers.
  s += antennae('M80 45 L86 38 L94 36', '#1a1408', 1.4);
  s += `<path d="M81 45 Q86 47 85 49 M81 51 Q86 49 85 47" fill="none" stroke="#c88a10" stroke-width="1.8" stroke-linecap="round"/>`;
  s += `<ellipse cx="76" cy="48" rx="6.5" ry="8" fill="#f2c14e" stroke="${INK}" stroke-width="1.6"/>`;
  s += `<ellipse cx="75" cy="42.5" rx="3.6" ry="2.6" fill="#d23a5a" stroke="${INK}" stroke-width="0.9"/><ellipse cx="75" cy="53.5" rx="3.6" ry="2.6" fill="#d23a5a" stroke="${INK}" stroke-width="0.9"/>`;
  s += `<path d="M73 41.5 l2 -0.6 M73 52.5 l2 -0.6" stroke="#fff" stroke-opacity="0.7" stroke-width="0.9" stroke-linecap="round"/>`;
  return s;
}

// ---------------------------------------------------------------------------------------------------
// Brute queen: a heavy crimson beast. A huge ribbed abdomen with pale seams where it has stretched,
// a broad armoured shoulder plate with spines at its corners, thick legs and great serrated jaws.
// ---------------------------------------------------------------------------------------------------
function brute() {
  const p = 'qbr';
  let s = defs(
    p,
    '#f6dcc8',
    '#d8a090',
    '#8a4a40',
    `<radialGradient id="${p}shell" cx="35%" cy="28%" r="75%"><stop offset="0" stop-color="#e05058"/><stop offset="0.45" stop-color="#8a1c24"/><stop offset="1" stop-color="#2a0608"/></radialGradient>`,
  );
  s += shadow(p, 46, 44, 22);
  // Thick legs; the back pair long.
  s += legs(
    [
      [52, 34],
      [44, 18],
      [32, 12],
    ],
    3.2,
    '#4a0c10',
  );
  s += legs(
    [
      [60, 36],
      [62, 20],
      [56, 10],
    ],
    3.2,
    '#4a0c10',
  );
  s += legs(
    [
      [66, 38],
      [76, 26],
      [80, 16],
    ],
    3.2,
    '#4a0c10',
  );
  s += belly(p, 30, 48, 27, 23);
  s += plates(p, 30, 48, 27, 23, [-0.7, -0.35, 0, 0.35, 0.68], 5.5, `url(#${p}shell)`, 0.74);
  // Shoulder plate with spines at its corners.
  for (const side of [-1, 1]) s += `<path d="M64 ${48 + side * 12} L60 ${48 + side * 21} L68 ${48 + side * 14} Z" fill="#e8dcc0" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
  s += `<path d="M56 48 C56 34 62 33 70 35 C74 38 75 44 75 48 C75 52 74 58 70 61 C62 63 56 62 56 48 Z" fill="url(#${p}shell)" stroke="${INK}" stroke-width="2"/>`;
  s += `<path d="M59 42 Q62 36 69 37" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="1.8" stroke-linecap="round"/>`;
  // Jaws: long, hooked and toothed, then the head over their roots.
  for (const side of [-1, 1]) {
    const y = (v) => 48 + side * v;
    s += `<path d="M78 ${y(5)} C86 ${y(14)} 94 ${y(12)} 94 ${y(4)} C92 ${y(7)} 88 ${y(8)} 84 ${y(5)} Z" fill="url(#${p}shell)" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
    s += `<path d="M86 ${y(7.5)} l1 ${side * -2} M89 ${y(7.5)} l0.6 ${side * -2}" stroke="${INK}" stroke-width="1"/>`;
  }
  s += `<ellipse cx="79" cy="48" rx="7" ry="8.5" fill="url(#${p}shell)" stroke="${INK}" stroke-width="1.8"/>`;
  s += `<circle cx="82" cy="44.5" r="1.4" fill="#ffb03c"/><circle cx="82" cy="51.5" r="1.4" fill="#ffb03c"/>`;
  return s;
}

// ---------------------------------------------------------------------------------------------------
// Beetle queen: an oil beetle. Her blue wing cases are too short to cover her any more: they part over
// a swollen, glossy, ringed abdomen. Beaded feelers.
// ---------------------------------------------------------------------------------------------------
function beetle() {
  const p = 'qbt';
  let s = defs(
    p,
    '#e4f0fa',
    '#9ab4cc',
    '#3a5270',
    `<radialGradient id="${p}shell" cx="36%" cy="26%" r="80%"><stop offset="0" stop-color="#9cc6ea"/><stop offset="0.35" stop-color="#4a74a0"/><stop offset="0.75" stop-color="#22385a"/><stop offset="1" stop-color="#121e32"/></radialGradient>`,
  );
  s += shadow(p, 46, 43, 22);
  s += legs(
    [
      [50, 36],
      [42, 20],
      [32, 14],
    ],
    2.6,
    '#1e2c44',
  );
  s += legs(
    [
      [58, 38],
      [60, 22],
      [54, 12],
    ],
    2.6,
    '#1e2c44',
  );
  s += legs(
    [
      [68, 40],
      [76, 28],
      [82, 20],
    ],
    2.6,
    '#1e2c44',
  );
  // The swollen abdomen, ringed with dark bands.
  s += belly(p, 30, 48, 28, 22);
  s += plates(p, 30, 48, 28, 22, [-0.72, -0.4, -0.08], 4.5, `url(#${p}shell)`);
  // Short wing cases, parted.
  for (const side of [-1, 1]) {
    const y = (v) => 48 + side * v;
    s += `<path d="M64 ${y(1.5)} C64 ${y(14)} 58 ${y(20)} 50 ${y(19)} C42 ${y(17)} 38 ${y(10)} 40 ${y(5)} C46 ${y(4)} 56 ${y(2)} 64 ${y(1.5)} Z" fill="url(#${p}shell)" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
    s += `<circle cx="52" cy="${y(10)}" r="1.1" fill="#1a2a44"/><circle cx="46" cy="${y(13)}" r="0.9" fill="#1a2a44"/>`;
  }
  s += `<path d="M46 ${48 - 15} Q52 ${48 - 19} 58 ${48 - 15}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1.8" stroke-linecap="round"/>`;
  // Shoulder plate and head.
  s += `<path d="M63 40 C66 37 72 37 74 41 L74 55 C72 59 66 59 63 56 Z" fill="url(#${p}shell)" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
  s += antennae('M82 45 Q88 40 90 34 Q91 30 94 28', '#1e2c44', 1.6);
  for (const [x, y] of [
    [86, 41],
    [89, 36],
    [91, 31],
  ])
    s += `<circle cx="${x}" cy="${y}" r="1.4" fill="#1e2c44"/><circle cx="${x}" cy="${96 - y}" r="1.4" fill="#1e2c44"/>`;
  s += `<ellipse cx="79" cy="48" rx="6" ry="6.5" fill="url(#${p}shell)" stroke="${INK}" stroke-width="1.6"/>`;
  s += `<circle cx="81" cy="45" r="1.4" fill="#8ad8ff" stroke="${INK}" stroke-width="0.5"/><circle cx="81" cy="51" r="1.4" fill="#8ad8ff" stroke="${INK}" stroke-width="0.5"/>`;
  return s;
}

const DRAW = { crawler, runner, brute, wasp, beetle };
export const QUEEN_BUGS = Object.keys(DRAW);

/** One queen's SVG, by bug. */
export const queenBug = (bug) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${DRAW[bug]()}</svg>`;
