// "Buildings" board: buildings that do something without showing it, and storage that shows how full it is.
// node docs/art-canvas/ideas/buildings.mjs [repo] [out]
import { read, swap, over, make, inner, box, uri, rng, idea, still, play, frames, board, INK } from './lib.mjs';

const TAU = Math.PI * 2;
const f1 = (n) => n.toFixed(1);
const four = [0, 1, 2, 3];

// --- Tree Nursery: the back row sprouts and fills out, the watering can tips and drips.
const nursery = (() => {
  const base = read('buildings/tree_nursery');
  const BACK = '<circle cx="34" cy="92" r="5" /><circle cx="64" cy="90" r="5.5" /><circle cx="94" cy="92" r="5" />';
  const MID = '<circle cx="34" cy="58" r="7" /><circle cx="64" cy="55" r="8" /><circle cx="94" cy="58" r="7" />';
  const CAN = '<g transform="translate(96 104)"';
  return four.map((i) => {
    const g = [2.5, 3.6, 4.8, 5.6][i];
    let s = swap(base, BACK, `<circle cx="34" cy="92" r="${f1(g)}" /><circle cx="64" cy="90" r="${f1(g * 1.1)}" /><circle cx="94" cy="92" r="${f1(g)}" />`, 'nursery back row');
    const sway = (k) => f1(Math.sin((i / 4) * TAU + k) * 0.9);
    s = swap(s, MID, `<circle cx="${34 + +sway(0)}" cy="58" r="7" /><circle cx="${64 + +sway(1)}" cy="55" r="8" /><circle cx="${94 + +sway(2)}" cy="58" r="7" />`, 'nursery middle row');
    const tip = [0, -14, -24, -10][i];
    s = swap(s, CAN, `<g transform="translate(96 104) rotate(${tip} -3 -1)"`, 'nursery can');
    // Drops from the spout while it's tipped, falling on the back row.
    const drops = i === 2 ? [[104, 96], [101, 100], [106, 101]] : i === 3 ? [[102, 100], [105, 104]] : [];
    return over(s, drops.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.2" ry="1.8" fill="#9ad4ff" stroke="${INK}" stroke-width="0.5" />`).join(''));
  });
})();

// --- Teleporter: the portal ring turns, the glow breathes, and motes spiral in.
const teleporter = (() => {
  const base = read('buildings/teleporter');
  return four.map((i) => {
    let s = swap(base, '<circle cx="31" cy="31" r="11" stroke-dasharray="4 3" />', `<circle cx="31" cy="31" r="11" stroke-dasharray="4 3" stroke-dashoffset="${-i * 1.75}" />`, 'teleporter ring');
    s = swap(s, '<circle cx="31" cy="31" r="17" fill="url(#tpGlow)" />', `<circle cx="31" cy="31" r="${[16, 17, 18, 17][i]}" fill="url(#tpGlow)" />`, 'teleporter glow');
    let motes = '';
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + (i / 4) * (TAU / 4);
      const r = 15 - ((i + k) % 4) * 2.5;
      motes += `<circle cx="${f1(31 + r * Math.cos(a))}" cy="${f1(31 + r * Math.sin(a))}" r="1.3" fill="#ffffff" opacity="${f1(0.4 + 0.15 * ((i + k) % 4))}" />`;
    }
    return over(s, motes);
  });
})();

// --- Drone Pad: the corner lights chase round and the landing ring turns.
const dronePad = (() => {
  const base = read('buildings/drone_pad');
  const LIGHTS = '<g fill="#6ee07a" stroke="#0f1a2e" stroke-width="1"><circle cx="11" cy="11" r="2.2" /><circle cx="51" cy="11" r="2.2" /><circle cx="11" cy="51" r="2.2" /><circle cx="51" cy="51" r="2.2" /></g>';
  const order = [[11, 11], [51, 11], [51, 51], [11, 51]];
  return four.map((i) => {
    let s = swap(base, 'stroke-dasharray="5 3" />', `stroke-dasharray="5 3" stroke-dashoffset="${i * 2}" />`, 'drone pad ring');
    const lights = order
      .map(([x, y], k) => (k === i ? `<circle cx="${x}" cy="${y}" r="5" fill="#6ee07a" opacity="0.35" /><circle cx="${x}" cy="${y}" r="2.4" fill="#d6ffd9" stroke="${INK}" stroke-width="1" />` : `<circle cx="${x}" cy="${y}" r="2.2" fill="#2f6a3a" stroke="${INK}" stroke-width="1" />`))
      .join('');
    return swap(s, LIGHTS, lights, 'drone pad lights');
  });
})();

// --- Shield Pylon: the orb pulses and a ring of light rises off it.
const pylon = (() => {
  const base = read('buildings/shield_pylon');
  return four.map((i) => {
    const halo = `<circle cx="32" cy="32" r="${[13, 15, 17, 14][i]}" fill="#9ad4ff" opacity="${[0.25, 0.4, 0.3, 0.2][i]}" />`;
    const ring = `<circle cx="32" cy="32" r="${12 + i * 4.5}" fill="none" stroke="#bfe9ff" stroke-width="1.6" opacity="${f1(0.9 - i * 0.25)}" />`;
    const s = swap(base, '<circle cx="32" cy="32" r="11" fill="url(#spOrb)"', `${halo}<circle cx="32" cy="32" r="11" fill="url(#spOrb)"`, 'pylon halo');
    return over(s, ring + (i === 1 ? '<circle cx="32" cy="32" r="5" fill="#ffffff" opacity="0.45" />' : ''));
  });
})();

// --- Railgun: the coils charge back to front, glow white, then it fires and cools.
const railgun = (() => {
  const base = read('buildings/railgun_base');
  const top = read('buildings/railgun_barrel');
  const COILS = '<g fill="#d98a3a" stroke="#0f1a2e" stroke-width="1.5"><rect x="76" y="46" width="6" height="36" rx="2" /><rect x="94" y="46" width="6" height="36" rx="2" /></g>';
  const LINE = '<path d="M66 64 H118" stroke="#6ec8ff" stroke-width="3" stroke-linecap="round" opacity="0.85" />';
  const steps = [
    ['#e8a050', '#d98a3a', 0.5, 0],
    ['#ffd6a0', '#e8a050', 0.7, 0],
    ['#eaf8ff', '#cfefff', 1, 0],
    ['#ffffff', '#ffffff', 1, 1],
    ['#f0b070', '#d98a3a', 0.6, 0],
  ];
  return steps.map(([back, front, line, fire]) => {
    const glow = (x, c) => (c === '#d98a3a' ? '' : `<rect x="${x - 4}" y="42" width="14" height="44" rx="5" fill="${c}" opacity="0.35" />`);
    let t = swap(top, COILS, `${glow(76, back)}${glow(94, front)}<g stroke="#0f1a2e" stroke-width="1.5"><rect x="76" y="46" width="6" height="36" rx="2" fill="${back}" /><rect x="94" y="46" width="6" height="36" rx="2" fill="${front}" /></g>`, 'railgun coils');
    t = swap(t, LINE, `<path d="M66 64 H118" stroke="#6ec8ff" stroke-width="${2 + line * 3}" stroke-linecap="round" opacity="${line}" />${line === 1 ? '<path d="M66 64 H118" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />' : ''}`, 'railgun line');
    if (fire) t = over(t, `<circle cx="122" cy="64" r="9" fill="#bfe9ff" opacity="0.6" /><circle cx="122" cy="64" r="4.5" fill="#ffffff" />`);
    return make(box(base), inner(base) + `<svg viewBox="${box(top)}" width="128" height="128">${inner(t)}</svg>`);
  });
})();

// --- Tesla bolt: three jagged bolts with forks, swapped every frame (the code draws one now).
const bolts = [11, 23, 37].map((seed) => {
  const r = rng(seed);
  const pts = [[4, 16]];
  for (let x = 14; x < 124; x += 10) pts.push([x + (r() - 0.5) * 4, 16 + (r() - 0.5) * 16]);
  pts.push([124, 16]);
  const d = 'M' + pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L');
  let forks = '';
  for (let k = 0; k < 3; k++) {
    const [x, y] = pts[2 + Math.floor(r() * (pts.length - 4))];
    const dir = r() < 0.5 ? -1 : 1;
    forks += `M${f1(x)} ${f1(y)} L${f1(x + 6 + r() * 4)} ${f1(y + dir * (4 + r() * 3))} L${f1(x + 12 + r() * 4)} ${f1(y + dir * (6 + r() * 4))}`;
  }
  return make(
    '0 0 128 32',
    `<path d="${d}" fill="none" stroke="#3fa9f5" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" opacity="0.25" />` +
      `<path d="${d}${forks}" fill="none" stroke="#8fd0ff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.9" />` +
      `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />` +
      `<circle cx="124" cy="16" r="5" fill="#bfe9ff" opacity="0.6" /><circle cx="124" cy="16" r="2.4" fill="#ffffff" />`,
  );
});

// --- Orbital Strike Beacon: the dish swings, the red light blinks, and signal rings rise.
const beacon = (() => {
  const base = read('buildings/strike_beacon');
  const DISH = '<path d="M18 22 Q31 4 44 22 Z"';
  const WAVES = '<g fill="none" stroke="#ff5a3c" stroke-width="1.5" opacity="0.8"><path d="M24 8 Q31 2 38 8" /><path d="M20 5 Q31 -4 42 5" /></g>';
  return four.map((i) => {
    const a = [-10, 0, 10, 0][i];
    let s = swap(base, DISH, `<path transform="rotate(${a} 31 22)" d="M18 22 Q31 4 44 22 Z"`, 'beacon dish');
    s = swap(s, '<circle cx="31" cy="11" r="3.5" fill="#ff5a3c"', `${i % 2 === 0 ? '<circle cx="31" cy="11" r="7" fill="#ff5a3c" opacity="0.35" />' : ''}<circle cx="31" cy="11" r="3.5" fill="${i % 2 === 0 ? '#ff8a6c' : '#7a2a1c'}"`, 'beacon light');
    const k = i / 4;
    const waves = `<g fill="none" stroke="#ff5a3c" stroke-width="1.5">${[0, 0.5].map((o) => {
      const t = (k + o) % 1;
      const w = 7 + t * 14;
      return `<path d="M${f1(31 - w)} ${f1(9 - t * 6)} Q31 ${f1(3 - t * 12)} ${f1(31 + w)} ${f1(9 - t * 6)}" opacity="${f1(0.9 - t * 0.8)}" />`;
    }).join('')}</g>`;
    return swap(s, WAVES, waves, 'beacon waves');
  });
})();

// --- Port: a crate rides out on the rollers, and the three lights count it out.
const port = (() => {
  const base = read('buildings/port');
  const CUBE_A = '<path d="M20 24 L30 19 L40 24 V36 L30 41 L20 36 Z"';
  return four.map((i) => {
    const dx = [-3, 1, 5, 9][i];
    const a = base.indexOf(CUBE_A);
    const b = base.indexOf('<path d="M22 25 L29 21.5"');
    const end = base.indexOf('/>', b) + 2;
    let s = base.slice(0, a) + `<g transform="translate(${dx} 0)" opacity="${i === 3 ? 0.55 : 1}">${base.slice(a, end)}</g>` + base.slice(end);
    s = swap(s, '<g fill="#ffd36b"><circle cx="22" cy="50" r="1.6" /><circle cx="28" cy="50" r="1.6" /><circle cx="34" cy="50" r="1.6" fill="#3a4656" /></g>', `<g>${[22, 28, 34].map((x, k) => `<circle cx="${x}" cy="50" r="1.6" fill="${k <= i - 1 || (i === 0 && k === 0) ? '#ffd36b' : '#3a4656'}" />`).join('')}</g>`, 'port lights');
    return s;
  });
})();

// --- Shipyard: a gantry crane runs between the towers, lowering its hook, and the tower lights blink in turn.
const shipyard = (() => {
  const base = read('buildings/shipyard');
  return four.map((i) => {
    const x = [64, 88, 112, 88][i];
    const drop = [0, 14, 20, 8][i];
    const crane =
      `<path d="M13 44 H179" stroke="${INK}" stroke-width="5" /><path d="M13 44 H179" stroke="#f2c14e" stroke-width="3" />` +
      `<rect x="${x - 8}" y="39" width="16" height="10" rx="2" fill="#3a4656" stroke="${INK}" stroke-width="2" />` +
      `<path d="M${x} 49 V${56 + drop}" stroke="${INK}" stroke-width="1.6" />` +
      `<path d="M${x - 3} ${56 + drop} h6 v3 q0 4 -3 4 q-3 0 -3 -3" fill="none" stroke="#c9d2de" stroke-width="2" stroke-linecap="round" />` +
      [13, 179].map((cx, k) => `<circle cx="${cx}" cy="38" r="${(i + k) % 2 === 0 ? 5 : 0}" fill="#ff5a4a" opacity="0.4" /><circle cx="${cx}" cy="38" r="2.2" fill="${(i + k) % 2 === 0 ? '#ff8a7a' : '#6a2a22'}" />`).join('');
    return over(base, crane);
  });
})();

// --- Storage that shows how full it is.
const item = (key, x, y, s) => `<image href="${uri(read(`items/${key}`))}" x="${x}" y="${y}" width="${s}" height="${s}" />`;
const crate = (() => {
  const base = read('buildings/crate');
  const heaps = [[], [['iron_plate', 30, 30, 22]], [['iron_plate', 12, 30, 22], ['iron_plate', 30, 30, 22], ['iron_plate', 21, 16, 22]], [['iron_plate', 8, 8, 22], ['iron_plate', 30, 8, 22], ['iron_plate', 8, 30, 22], ['iron_plate', 30, 30, 22], ['iron_plate', 19, 19, 24]]];
  return heaps.map((h) =>
    h.length === 0 ? base : over(swap(base, '<path d="M9 9 L55 55 M55 9 L9 55" stroke="#7a4a22"', '<path d="M9 9 L55 55 M55 9 L9 55" stroke="#7a4a22" opacity="0"', 'crate lid').replace('<path d="M9 9 L55 55 M55 9 L9 55" stroke="#c48f52"', '<path d="M9 9 L55 55 M55 9 L9 55" opacity="0" stroke="#c48f52"').replace('<path d="M5 18 H59 M5 32 H59 M5 46 H59" stroke="#8a5a32"', '<rect x="8" y="8" width="48" height="48" rx="2" fill="#4a2f18" /><path d="M5 18 H59 M5 32 H59 M5 46 H59" opacity="0" stroke="#8a5a32"'), h.map((a) => item(...a)).join('')),
  );
})();
const unit = (() => {
  const base = read('buildings/storage');
  const slots = [[10, 10], [34, 10], [10, 48], [34, 48], [10, 86], [34, 86]];
  const goods = ['gear', 'iron_plate', 'log', 'plank', 'copper_ingot', 'circuit'];
  return [0, 2, 4, 6].map((n) => over(base, slots.slice(0, n).map(([x, y], k) => item(goods[k], x + 1, y + 7, 18)).join('')));
})();
const silo = (() => {
  const base = read('buildings/storage_silo');
  // A gauge round the roof's rim: lit segments from the top, clockwise.
  return [0, 1 / 3, 2 / 3, 1].map((full) => {
    let g = '';
    const n = 24;
    for (let k = 0; k < n; k++) {
      const a0 = -Math.PI / 2 + (k / n) * TAU + 0.03;
      const a1 = -Math.PI / 2 + ((k + 1) / n) * TAU - 0.03;
      const lit = k < Math.round(full * n);
      g += `<path d="M${f1(60 + 53 * Math.cos(a0))} ${f1(64 + 53 * Math.sin(a0))} A53 53 0 0 1 ${f1(60 + 53 * Math.cos(a1))} ${f1(64 + 53 * Math.sin(a1))}" stroke="${lit ? '#3fa9f5' : '#2a3442'}" stroke-width="4" fill="none" />`;
    }
    return over(base, g);
  });
})();

const B = 150;
board('IdeasBuildings.dc.html', {
  title: 'Ideas · Buildings',
  kicker: 'Ideas · proposed, not in the game',
  heading: 'Buildings that show what they do',
  intro: 'Buildings that work, send or guard without anything on them moving, and storage that could show how full it is. Each is built from the game\'s own sprite: the sprite now, its frames, and the frames played.',
  ideas: [
    idea('Tree Nursery', 'It plants a young tree nearby every few seconds, so it could show the saplings growing: the back row sprouts and fills out, the middle row sways, and the watering can tips and drips onto them.', [['Now', still(read('buildings/tree_nursery'), 120)], ['4 frames', frames(nursery, 104)], ['Played', play(nursery, 4, B)]], 'buildings/tree_nursery_working_4f'),
    idea('Teleporter Pad', 'The portal ring turns, the glow swells and settles, and motes of light spiral into the middle. Could play only while it sends or pulls.', [['Now', still(read('buildings/teleporter'), 104)], ['4 frames', frames(teleporter, 96)], ['Played', play(teleporter, 8, B)]], 'buildings/teleporter_working_4f'),
    idea('Drone Pad', 'The corner lights chase round the pad and the dashed landing ring turns, like a runway waiting for its drone.', [['Now', still(read('buildings/drone_pad'), 104)], ['4 frames', frames(dronePad, 96)], ['Played', play(dronePad, 6, B)]], 'buildings/drone_pad_working_4f'),
    idea('Shield Pylon', 'The orb pulses and a ring of light rises off it and fades, while the dome is up (the dome stays drawn in code).', [['Now', still(read('buildings/shield_pylon'), 104)], ['4 frames', frames(pylon, 96)], ['Played', play(pylon, 6, B)]], 'buildings/shield_pylon_working_4f'),
    idea('Railgun charging', 'Before each shot the copper coils heat from the back coil forward, glow white along the rails, then it fires (the slug stays drawn in code) and they cool.', [['Now', still(railgun[4].replace(/#f0b070/g, '#d98a3a').replace(/<rect x="72"[^>]*\/>/, ''), 120)], ['5 frames', frames(railgun, 104)], ['Played, with a pause', play([...railgun, railgun[4], railgun[4]].map((f, k) => (k > 4 ? read('buildings/railgun_base').replace('</svg>', '') + `<svg viewBox="0 0 128 128" width="128" height="128">${inner(read('buildings/railgun_barrel'))}</svg></svg>` : f)), 6, B)]], 'buildings/railgun_barrel_charge_5f'),
    idea('Tesla bolt', 'The tesla\'s lightning is drawn in code now, from a guide in <code>docs/art-upgrade/</code>. Three bolt sprites, each with a glow, a white core and forks, swapped every frame and stretched to the target, would match the drawn art.', [['3 frames (128 × 32)', frames(bolts, 200, '#1d2a3c')], ['Played', play(bolts, 12, 300, '#1d2a3c')]], 'effects/tesla_bolt_3f'),
    idea('Orbital Strike Beacon', 'The dish swings to and fro, the red light blinks, and rings of signal rise from it.', [['Now', still(read('buildings/strike_beacon'), 104)], ['4 frames', frames(beacon, 96)], ['Played', play(beacon, 5, B)]], 'buildings/strike_beacon_working_4f'),
    idea('Port', 'A crate rides out on the rollers toward the hatch while the three lights count it out.', [['Now', still(read('buildings/port'), 104)], ['4 frames', frames(port, 96)], ['Played', play(port, 4, B)]], 'buildings/port_working_4f'),
    idea('Shipyard', 'A gantry crane across the two towers: its trolley runs along the beam and lowers its hook, and the tower lights blink in turn. Could play while the ship is being built.', [['Now', still(read('buildings/shipyard'), 150)], ['4 frames', frames(shipyard, 130)], ['Played', play(shipyard, 3, 190)]], 'buildings/shipyard_working_4f'),
    idea(
      'Storage that fills up',
      'Better than an animation for storage: a few sprites for how full it is. The crate loses its lid and fills with what it holds; the Storage Unit\'s compartments fill one by one; the silo lights a gauge round its roof. Empty, a third, two thirds, full.',
      [
        [['Crate', frames(crate, 96)]],
        [['Storage Unit', frames(unit, 72)]],
        [['Storage Silo', frames(silo, 120)]],
      ],
      'buildings/crate_1 to _3, storage_1 to _3, storage_silo_1 to _3 (or the game draws the contents)',
    ),
  ],
});
