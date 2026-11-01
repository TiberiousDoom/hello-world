// Builds the machines' working animations (D-082) from their own sprites: each strip is 4 frames of the
// building's SVG with only its moving parts changed (a rotor or saw turning, gears, flames, smoke, sparks,
// sawdust). Run `node art/working.mjs` after redrawing a machine; it writes
// src/art/buildings/<type>_working_4f.svg next to the sprite it comes from.
//
// Each change is a find-and-replace on the sprite's own markup, so a redraw that moves a part makes this
// fail loudly rather than animate the wrong thing.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'art', 'buildings');
const FRAMES = 4;

/** Replaces `find` (which must occur exactly once) in `svg`. */
function swap(svg, find, replace, what) {
  const n = svg.split(find).length - 1;
  if (n !== 1) throw new Error(`${what}: expected one match for ${JSON.stringify(find.slice(0, 60))}, found ${n}`);
  return svg.replace(find, replace);
}

/** Inserts `extra` just before the sprite's closing tag (drawn on top of everything). */
const onTop = (svg, extra) => svg.replace(/<\/svg>\s*$/, `${extra}</svg>`);

/** Small dots at (x, y) pairs, for sparks, chips and sawdust. */
const dots = (fill, pts, r = 1.2) => `<g fill="${fill}">${pts.map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr ?? r}" />`).join('')}</g>`;

/** Each machine: how frame `i` (0–3) differs from the still sprite. */
const MACHINES = {
  extractor(svg, i) {
    // The rotor has three blades: 30° a frame turns it a third of the way round in 4 frames, so it loops.
    svg = swap(svg, '<g transform="translate(64 64)" stroke="#0f1a2e"', `<g transform="translate(64 64) rotate(${30 * i})" stroke="#0f1a2e"`, 'extractor rotor');
    const chips = [
      [[46, 46], [84, 52], [70, 86]],
      [[52, 40], [90, 64], [60, 88]],
      [[42, 56], [86, 78], [74, 42]],
      [[48, 82], [80, 44], [92, 70]],
    ][i];
    return onTop(svg, dots('#a88a5c', chips, 1.8));
  },
  furnace(svg, i) {
    svg = swap(svg, 'fill="#ff8a3d" opacity="0.55"', `fill="#ff8a3d" opacity="${[0.5, 0.7, 0.58, 0.78][i]}"`, 'furnace glow');
    // Flames licking up the firebox, a little different each frame.
    const h = [
      [16, 24, 18],
      [22, 17, 25],
      [18, 26, 15],
      [25, 19, 22],
    ][i];
    const flames = [48, 62, 76]
      .map((x, k) => `<path d="M${x - 7} 87 Q${x - 6} ${87 - h[k] * 0.6} ${x + (i % 2 ? 1 : -1)} ${87 - h[k]} Q${x + 6} ${87 - h[k] * 0.6} ${x + 7} 87 Z" />`)
      .join('');
    // Smoke from the chimney, rising and fading through the loop.
    const puff = (k) => {
      const t = (i + k) % FRAMES;
      return `<circle cx="${32 + t * 6}" cy="${15 - t * 2.5}" r="${3.5 + t * 1.2}" opacity="${0.55 - t * 0.12}" />`; // stays inside the frame
    };
    svg = swap(
      svg,
      /<g fill="#d6dbe2">.*?<\/g>/s.exec(svg)?.[0] ?? '<g fill="#d6dbe2">',
      `<g fill="#d6dbe2">${[0, 2].map(puff).join('')}</g>`,
      'furnace smoke',
    );
    const embers = [
      [[54, 62], [70, 74], [62, 54]],
      [[56, 56], [68, 68], [60, 48]],
      [[52, 50], [72, 62], [64, 70]],
      [[58, 66], [66, 52], [50, 58]],
    ][i];
    return onTop(svg, `<g fill="#ffb347" opacity="0.85">${flames}</g>${dots('#fff6d0', embers, 1.6)}`);
  },
  workshop(svg, i) {
    // Ten teeth: a quarter tooth a frame for the big gear, half a tooth the other way for the small one.
    svg = swap(svg, 'translate(46 52) rotate(8)', `translate(46 52) rotate(${8 + 9 * i})`, 'workshop big gear');
    svg = swap(svg, 'translate(73.5 79.5) rotate(26)', `translate(73.5 79.5) rotate(${26 - 18 * i})`, 'workshop small gear');
    svg = swap(svg, '<circle cx="104" cy="104" r="9" fill="#ffd36b" opacity="0.2" />', `<circle cx="104" cy="104" r="9" fill="#ffd36b" opacity="${i % 2 ? 0.45 : 0.15}" />`, 'workshop lamp');
    return svg;
  },
  assembler(svg, i) {
    // The arm nods over the work, sparks at its tip, the gear turns and the lights take turns.
    const start = '<path d="M84 156 L70 116 L100 94" fill="none" stroke="#0f1a2e" stroke-width="15"';
    const end = '<circle cx="98" cy="96" r="2" fill="#ff8a3d" />';
    const a = svg.indexOf(start);
    const b = svg.indexOf(end);
    if (a < 0 || b < a) throw new Error('assembler arm: not found');
    const arm = svg.slice(a, b + end.length);
    const angle = [0, -5, 0, 4][i];
    svg = svg.slice(0, a) + `<g transform="rotate(${angle} 84 156)">${arm}${i % 2 ? '' : '<circle cx="100" cy="94" r="5" fill="#fff3b0" opacity="0.8" />'}</g>` + svg.slice(b + end.length);
    svg = swap(svg, '<g transform="translate(108 92)"', `<g transform="translate(108 92) rotate(${11.25 * i})"`, 'assembler gear');
    svg = swap(svg, '<circle cx="28" cy="28" r="5" fill="#6ee07a" />', `<circle cx="28" cy="28" r="5" fill="${i < 2 ? '#6ee07a' : '#2c6b38'}" />`, 'assembler green light');
    svg = swap(svg, '<circle cx="164" cy="28" r="5" fill="#3fa9f5" />', `<circle cx="164" cy="28" r="5" fill="${i < 2 ? '#1d4f78' : '#3fa9f5'}" />`, 'assembler blue light');
    return svg;
  },
  repair(svg, i) {
    // Eight teeth: an eighth of a turn over the loop. The torch flares and the light blinks.
    svg = swap(svg, 'transform="translate(29 30) scale(0.15)"', `transform="translate(29 30) rotate(${11.25 * i}) scale(0.15)"`, 'repair gear');
    svg = swap(svg, '<circle cx="41" cy="17" r="5" fill="#bfe4ff" opacity="0.35" />', `<circle cx="41" cy="17" r="${[5, 7, 4.5, 6.5][i]}" fill="#bfe4ff" opacity="${[0.35, 0.55, 0.3, 0.5][i]}" />`, 'repair torch glow');
    const sparks = [
      'M41 17 l-4 -2 M41 17 l-1 -4.5 M41 17 l-4.5 1.5 M41 17 l-2 4',
      'M41 17 l-5 -1 M41 17 l0 -5 M41 17 l-3.5 3 M41 17 l3 3',
      'M41 17 l-3 -3.5 M41 17 l2 -4 M41 17 l-5 0.5 M41 17 l-1 4.5',
      'M41 17 l-4.5 -3 M41 17 l-2 -4 M41 17 l-3 3.5 M41 17 l4 1',
    ][i];
    svg = swap(svg, 'M41 17 l-4 -2 M41 17 l-1 -4.5 M41 17 l-4.5 1.5 M41 17 l-2 4', sparks, 'repair sparks');
    svg = swap(svg, '<circle cx="14" cy="14" r="3" fill="#6ee07a"', `<circle cx="14" cy="14" r="3" fill="${i % 2 ? '#2c6b38' : '#6ee07a'}"`, 'repair light');
    return svg;
  },
  lumber_camp(svg, i) {
    // Sixteen teeth: a quarter tooth a frame. Sawdust flies off the cut.
    svg = swap(svg, 'translate(96 64) rotate(10)', `translate(96 64) rotate(${10 + 5.625 * i})`, 'lumber camp saw');
    const dust = [
      [[84, 86], [88, 92], [80, 94], [106, 88]],
      [[82, 90], [90, 96], [78, 98], [108, 92]],
      [[86, 84], [84, 94], [92, 88], [104, 84]],
      [[80, 88], [88, 98], [94, 92], [110, 90]],
    ][i];
    svg = swap(svg, /<g fill="#e6c48c">.*?<\/g>/s.exec(svg)?.[0] ?? 'lumber dust', dots('#e6c48c', dust), 'lumber camp sawdust');
    return svg;
  },
  blacksmith(svg, i) {
    // The hammer rises and strikes the ingot on the anvil; sparks fly on the strike, and the coals breathe.
    svg = swap(svg, '<g id="bHammer" transform="rotate(0 92 54)">', `<g id="bHammer" transform="rotate(${[0, -18, -30, -10][i]} 92 54)">`, 'blacksmith hammer');
    svg = swap(svg, 'fill="#ff8a3d" opacity="0.5" filter="url(#bBlur)"', `fill="#ff8a3d" opacity="${[0.5, 0.7, 0.55, 0.75][i]}" filter="url(#bBlur)"`, 'blacksmith coals');
    const sparks = i === 0 ? [[52, 60], [76, 58], [58, 54], [72, 52], [66, 50]] : i === 3 ? [[56, 62], [74, 60]] : [];
    svg = swap(svg, '<g fill="#ffd36b" opacity="0"><circle cx="58" cy="64" r="1.5" /></g>', dots('#ffd36b', sparks.length ? sparks : [[64, 64, 0]], 1.6), 'blacksmith sparks');
    return svg;
  },
  machine_shop(svg, i) {
    // The lathe's chuck spins, the gears turn against each other and the light blinks.
    svg = swap(svg, 'translate(52 45) rotate(0)', `translate(52 45) rotate(${30 * i})`, 'machine shop chuck');
    svg = swap(svg, 'translate(40 88) rotate(0)', `translate(40 88) rotate(${7.5 * i})`, 'machine shop big gear');
    svg = swap(svg, 'translate(70 96) rotate(0) scale(0.6)', `translate(70 96) rotate(${-12.5 * i}) scale(0.6)`, 'machine shop small gear');
    svg = swap(svg, '<circle cx="100" cy="22" r="5" fill="#6ee07a"', `<circle cx="100" cy="22" r="5" fill="${i % 2 ? '#2c6b38' : '#6ee07a'}"`, 'machine shop light');
    return svg;
  },
  steel_works(svg, i) {
    // The rolls turn against each other, the billet passes between them, and its glow breathes.
    svg = swap(svg, 'translate(62 46) rotate(0)', `translate(62 46) rotate(${22.5 * i})`, 'steel works top roll');
    svg = swap(svg, 'translate(62 82) rotate(0)', `translate(62 82) rotate(${-22.5 * i})`, 'steel works bottom roll');
    svg = swap(svg, '<rect x="20" y="59" width="34" height="10"', `<rect x="${20 + 4 * i}" y="59" width="34" height="10"`, 'steel works billet');
    svg = swap(svg, 'opacity="0.55" filter="url(#kBlur)"', `opacity="${[0.55, 0.75, 0.6, 0.8][i]}" filter="url(#kBlur)"`, 'steel works glow');
    svg = swap(svg, '<circle cx="100" cy="22" r="5" fill="#6ee07a"', `<circle cx="100" cy="22" r="5" fill="${i % 2 ? '#2c6b38' : '#6ee07a'}"`, 'steel works light');
    return svg;
  },
  boiler(svg, i) {
    // The fire flickers behind the grate, its glow breathes, and smoke puffs from the stack.
    svg = swap(svg, 'fill="url(#oFire)" opacity="0.85"', `fill="url(#oFire)" opacity="${[0.85, 1, 0.75, 0.95][i]}"`, 'boiler fire');
    svg = swap(svg, 'fill="#ff8a3d" opacity="0.35" filter="url(#oBlur)"', `fill="#ff8a3d" opacity="${[0.35, 0.55, 0.3, 0.5][i]}" filter="url(#oBlur)"`, 'boiler glow');
    const smoke = [[[96, 86, 4], [100, 80, 3]], [[97, 84, 4.5], [102, 77, 3.5]], [[98, 82, 5], [104, 74, 4]], [[96, 87, 3.5], [101, 79, 3]]][i];
    return swap(svg, /<g fill="#d9dde2" opacity="0.7" id="oSmoke">.*?<\/g>/s.exec(svg)?.[0] ?? 'boiler smoke', `<g fill="#d9dde2" opacity="0.7" id="oSmoke">${smoke.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" />`).join('')}</g>`, 'boiler smoke');
  },
  steam_turbine(svg, i) {
    // Eight blades: an eighth of a turn over the loop. The spark at the coil blinks.
    svg = swap(svg, 'translate(58 64) rotate(0)', `translate(58 64) rotate(${11.25 * i})`, 'turbine rotor');
    return swap(svg, '<circle cx="90" cy="18" r="4" fill="#f2c14e"', `<circle cx="90" cy="18" r="4" fill="${i % 2 ? '#fff4c2' : '#f2c14e'}"`, 'turbine spark');
  },
  circuit_works(svg, i) {
    // The placing head dips to the board and sparks as it solders; the light blinks.
    svg = swap(svg, '<g transform="translate(55 63)" id="cwHead">', `<g transform="translate(55 ${63 + [0, 4, 6, 3][i]})" id="cwHead">`, 'circuit works head');
    svg = swap(svg, 'fill="#ffd36b" opacity="0.4" id="cwSpark"', `fill="#ffd36b" opacity="${[0.4, 0.8, 1, 0.6][i]}" id="cwSpark"`, 'circuit works spark');
    return swap(svg, '<circle cx="100" cy="22" r="5" fill="#6ee07a"', `<circle cx="100" cy="22" r="5" fill="${i % 2 ? '#2c6b38' : '#6ee07a'}"`, 'circuit works light');
  },
  powder_mill(svg, i) {
    // The edge runners roll round the pan: a quarter turn over the loop, two-fold symmetric. The light blinks.
    svg = swap(svg, 'translate(56 62) rotate(0)', `translate(56 62) rotate(${45 * i})`, 'powder mill runners');
    return swap(svg, '<circle cx="100" cy="22" r="5" fill="#6ee07a"', `<circle cx="100" cy="22" r="5" fill="${i % 2 ? '#2c6b38' : '#6ee07a'}"`, 'powder mill light');
  },
  well(svg, i) {
    // The crank turns a quarter of the way round over the loop, and back to the start: four-fold symmetric.
    svg = swap(svg, '<g id="wCrank" transform="rotate(0 64 64)">', `<g id="wCrank" transform="rotate(${22.5 * i} 64 64)">`, 'well crank');
    // The bucket on its rope comes up full and goes back down (D-160): smaller as it sinks into the well.
    const d = [0.14, 0.07, 0, 0.07][i];
    const k = 1 - d * 2;
    return onTop(svg, `<path d="M64 38 V${(54 + d * 128).toFixed(1)}" stroke="#c9a06a" stroke-width="1.4" /><g transform="translate(64 ${(61 + d * 128).toFixed(1)}) scale(${k.toFixed(2)})"><rect x="-11.5" y="-11.5" width="23" height="23" rx="2.5" fill="#8a6234" stroke="#0f1a2e" stroke-width="1.6" /><rect x="-9" y="-9" width="18" height="18" rx="2" fill="${i === 2 ? '#7fc4ec' : '#3a2a1c'}" /></g>`);
  },
  water_wheel(svg, i) {
    // Eight paddles: an eighth of a turn over the loop. Spray flies off the paddles in the water.
    svg = swap(svg, 'translate(160 32) rotate(0)', `translate(160 32) rotate(${11.25 * i})`, 'water wheel');
    const spray = [[[150, 58], [168, 60]], [[154, 60], [172, 58]], [[148, 60], [164, 58]], [[156, 58], [170, 60]]][i];
    svg = swap(svg, '<g fill="#d6f0ff" opacity="0"><circle cx="150" cy="56" r="2" /></g>', dots('#d6f0ff', spray, 2), 'water wheel spray');
    // Splashes thrown off the rim as the paddles come round, and a ring of foam (D-160).
    let splash = '';
    for (let k = 0; k < 9; k++) {
      const a = ((k / 9) * 0.9 + i * 0.22) * Math.PI + Math.PI * 0.3;
      const d = 30 + ((k * 7 + i * 3) % 7);
      splash += `<circle cx="${(160 + d * Math.cos(a)).toFixed(1)}" cy="${(32 + d * Math.sin(a)).toFixed(1)}" r="${(1.2 + ((k + i) % 3) * 0.6).toFixed(1)}" fill="#e8f8ff" stroke="#3a7aa8" stroke-width="0.5" />`;
    }
    return onTop(svg, `<circle cx="160" cy="32" r="${31 + i}" fill="none" stroke="#e8f8ff" stroke-width="1.6" stroke-dasharray="${3 + i} 5" stroke-dashoffset="${i * 4}" opacity="0.7" />${splash}`);
  },
  sawmill(svg, i) {
    svg = swap(svg, 'translate(64 64) rotate(4)', `translate(64 64) rotate(${4 + 5.625 * i})`, 'sawmill saw');
    // The log feeds into the blade.
    svg = swap(svg, '<use href="#mLog" x="16" y="57.5" transform="translate(0 0)" />', `<use href="#mLog" x="16" y="57.5" transform="translate(${2 * i} 0)" />`, 'sawmill log');
    const dust = [
      [[76, 88], [72, 92], [80, 94], [70, 40]],
      [[74, 90], [78, 96], [84, 92], [74, 36]],
      [[78, 86], [70, 94], [82, 98], [68, 38]],
      [[72, 88], [76, 98], [86, 94], [76, 40]],
    ][i];
    svg = swap(svg, /<g fill="#e6c48c">.*?<\/g>/s.exec(svg)?.[0] ?? 'sawmill dust', dots('#e6c48c', dust), 'sawmill sawdust');
    return svg;
  },
  greenhouse(svg, i) {
    // The saplings sway (each row a little out of step), the grow light warms under the glass, mist drifts
    // down from the two crossbars, and the power light by the input pulses.
    const plants = [
      [34, 36, 12], [64, 32, 10], [94, 38, 12],
      [36, 70, 10], [66, 66, 13], [94, 72, 10],
      [34, 98, 9], [64, 98, 11], [94, 100, 9],
    ];
    const LEAVES = '<g fill="#3f8f4f" stroke="#1f4a28" stroke-width="2">';
    const a = svg.indexOf(LEAVES);
    const b = svg.indexOf('</g>', svg.indexOf('<g fill="#6cbf5a">')) + 4;
    if (a < 0 || b < 4) throw new Error('greenhouse plants: not found');
    const ph = (i / FRAMES) * Math.PI * 2;
    let leaves = LEAVES;
    let lights = '<g fill="#6cbf5a">';
    plants.forEach(([x, y, r], k) => {
      const dx = 1.6 * Math.sin(ph + (k % 3) * 1.1 + Math.floor(k / 3) * 0.7);
      const rr = r * (1 + 0.05 * Math.sin(ph + k));
      leaves += `<circle cx="${(x + dx).toFixed(1)}" cy="${y}" r="${rr.toFixed(1)}" />`;
      lights += `<circle cx="${(x + dx - rr * 0.28).toFixed(1)}" cy="${(y - rr * 0.28).toFixed(1)}" r="${(rr * 0.34).toFixed(1)}" />`;
    });
    svg = svg.slice(0, a) + leaves + '</g>' + lights + '</g>' + svg.slice(b);
    const GLASS = '<rect x="12" y="12" width="104" height="104" rx="6" fill="url(#ghGlass)"';
    svg = swap(svg, GLASS, `<rect x="12" y="12" width="104" height="104" rx="6" fill="#ffd36b" opacity="${[0.1, 0.22, 0.14, 0.06][i]}" />${GLASS}`, 'greenhouse glow');
    const mist = [];
    for (const bar of [46, 82])
      for (const x of [24, 40, 56, 72, 88, 104]) {
        const d = 3 + ((i * 4 + x / 8) % 12);
        mist.push(`<circle cx="${x + ((x / 8) % 3) - 1}" cy="${(bar + d).toFixed(1)}" r="${(2.4 - d / 10).toFixed(1)}" opacity="${(1 - d / 18).toFixed(2)}" />`);
      }
    return onTop(svg, `<g fill="#e8f8ff">${mist.join('')}</g><circle cx="112" cy="65" r="${[5, 7, 5, 4][i]}" fill="#3fa9f5" opacity="${[0.25, 0.4, 0.25, 0.15][i]}" />`);
  },
  // --- Buildings that show what they do (D-157) ---
  tree_nursery(svg, i) {
    // The back row sprouts and fills out, the middle row sways, and the watering can tips and drips.
    const g = [2.5, 3.6, 4.8, 5.6][i];
    svg = swap(svg, '<circle cx="34" cy="92" r="5" /><circle cx="64" cy="90" r="5.5" /><circle cx="94" cy="92" r="5" />', `<circle cx="34" cy="92" r="${g.toFixed(1)}" /><circle cx="64" cy="90" r="${(g * 1.1).toFixed(1)}" /><circle cx="94" cy="92" r="${g.toFixed(1)}" />`, 'nursery back row');
    const sway = (k) => (Math.sin((i / FRAMES) * Math.PI * 2 + k) * 0.9).toFixed(1);
    svg = swap(svg, '<circle cx="34" cy="58" r="7" /><circle cx="64" cy="55" r="8" /><circle cx="94" cy="58" r="7" />', `<circle cx="${34 + +sway(0)}" cy="58" r="7" /><circle cx="${64 + +sway(1)}" cy="55" r="8" /><circle cx="${94 + +sway(2)}" cy="58" r="7" />`, 'nursery middle row');
    svg = swap(svg, '<g transform="translate(96 104)"', `<g transform="translate(96 104) rotate(${[0, -14, -24, -10][i]} -3 -1)"`, 'nursery can');
    const drops = [[], [], [[104, 96], [101, 100], [106, 101]], [[102, 100], [105, 104]]][i];
    return onTop(svg, drops.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.2" ry="1.8" fill="#9ad4ff" stroke="#0f1a2e" stroke-width="0.5" />`).join(''));
  },
  teleporter(svg, i) {
    // The portal ring turns, the glow swells and settles, and motes of light spiral in.
    svg = swap(svg, '<circle cx="31" cy="31" r="11" stroke-dasharray="4 3" />', `<circle cx="31" cy="31" r="11" stroke-dasharray="4 3" stroke-dashoffset="${-i * 1.75}" />`, 'teleporter ring');
    svg = swap(svg, '<circle cx="31" cy="31" r="17" fill="url(#tpGlow)" />', `<circle cx="31" cy="31" r="${[16, 17, 18, 17][i]}" fill="url(#tpGlow)" />`, 'teleporter glow');
    let motes = '';
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + (i / 4) * (Math.PI / 2);
      const r = 15 - ((i + k) % 4) * 2.5;
      motes += `<circle cx="${(31 + r * Math.cos(a)).toFixed(1)}" cy="${(31 + r * Math.sin(a)).toFixed(1)}" r="1.3" fill="#ffffff" opacity="${(0.4 + 0.15 * ((i + k) % 4)).toFixed(2)}" />`;
    }
    return onTop(svg, motes);
  },
  drone_pad(svg, i) {
    // The corner lights chase round the pad and the dashed landing ring turns.
    svg = swap(svg, 'stroke-dasharray="5 3" />', `stroke-dasharray="5 3" stroke-dashoffset="${i * 2}" />`, 'drone pad ring');
    const LIGHTS = '<g fill="#6ee07a" stroke="#0f1a2e" stroke-width="1"><circle cx="11" cy="11" r="2.2" /><circle cx="51" cy="11" r="2.2" /><circle cx="11" cy="51" r="2.2" /><circle cx="51" cy="51" r="2.2" /></g>';
    const lights = [[11, 11], [51, 11], [51, 51], [11, 51]]
      .map(([x, y], k) => (k === i ? `<circle cx="${x}" cy="${y}" r="5" fill="#6ee07a" opacity="0.35" /><circle cx="${x}" cy="${y}" r="2.4" fill="#d6ffd9" stroke="#0f1a2e" stroke-width="1" />` : `<circle cx="${x}" cy="${y}" r="2.2" fill="#2f6a3a" stroke="#0f1a2e" stroke-width="1" />`))
      .join('');
    return swap(svg, LIGHTS, lights, 'drone pad lights');
  },
  shield_pylon(svg, i) {
    // The orb pulses and a ring of light rises off it and fades.
    const halo = `<circle cx="32" cy="32" r="${[13, 15, 17, 14][i]}" fill="#9ad4ff" opacity="${[0.25, 0.4, 0.3, 0.2][i]}" />`;
    svg = swap(svg, '<circle cx="32" cy="32" r="11" fill="url(#spOrb)"', `${halo}<circle cx="32" cy="32" r="11" fill="url(#spOrb)"`, 'pylon halo');
    return onTop(svg, `<circle cx="32" cy="32" r="${12 + i * 4.5}" fill="none" stroke="#bfe9ff" stroke-width="1.6" opacity="${(0.9 - i * 0.25).toFixed(2)}" />` + (i === 1 ? '<circle cx="32" cy="32" r="5" fill="#ffffff" opacity="0.45" />' : ''));
  },
  strike_beacon(svg, i) {
    // The dish swings to and fro, the red light blinks, and rings of signal rise from it.
    svg = swap(svg, '<path d="M18 22 Q31 4 44 22 Z"', `<path transform="rotate(${[-10, 0, 10, 0][i]} 31 22)" d="M18 22 Q31 4 44 22 Z"`, 'beacon dish');
    svg = swap(svg, '<circle cx="31" cy="11" r="3.5" fill="#ff5a3c"', `${i % 2 === 0 ? '<circle cx="31" cy="11" r="7" fill="#ff5a3c" opacity="0.35" />' : ''}<circle cx="31" cy="11" r="3.5" fill="${i % 2 === 0 ? '#ff8a6c' : '#7a2a1c'}"`, 'beacon light');
    const waves = [0, 0.5]
      .map((o) => {
        const t = (i / 4 + o) % 1;
        const w = 7 + t * 14;
        return `<path d="M${(31 - w).toFixed(1)} ${(9 - t * 6).toFixed(1)} Q31 ${(3 - t * 12).toFixed(1)} ${(31 + w).toFixed(1)} ${(9 - t * 6).toFixed(1)}" opacity="${(0.9 - t * 0.8).toFixed(2)}" />`;
      })
      .join('');
    return swap(svg, '<g fill="none" stroke="#ff5a3c" stroke-width="1.5" opacity="0.8"><path d="M24 8 Q31 2 38 8" /><path d="M20 5 Q31 -4 42 5" /></g>', `<g fill="none" stroke="#ff5a3c" stroke-width="1.5">${waves}</g>`, 'beacon waves');
  },
  port(svg, i) {
    // A crate rides out toward the hatch while the three lights count it out.
    const a = svg.indexOf('<path d="M20 24 L30 19 L40 24 V36 L30 41 L20 36 Z"');
    const end = svg.indexOf('/>', svg.indexOf('<path d="M22 25 L29 21.5"')) + 2;
    if (a < 0 || end < 2) throw new Error('port crate: not found');
    svg = svg.slice(0, a) + `<g transform="translate(${[-3, 1, 5, 9][i]} 0)" opacity="${i === 3 ? 0.55 : 1}">${svg.slice(a, end)}</g>` + svg.slice(end);
    const lights = [22, 28, 34].map((x, k) => `<circle cx="${x}" cy="50" r="1.6" fill="${k <= i - 1 || (i === 0 && k === 0) ? '#ffd36b' : '#3a4656'}" />`).join('');
    return swap(svg, '<g fill="#ffd36b"><circle cx="22" cy="50" r="1.6" /><circle cx="28" cy="50" r="1.6" /><circle cx="34" cy="50" r="1.6" fill="#3a4656" /></g>', `<g>${lights}</g>`, 'port lights');
  },
  shipyard(svg, i) {
    // A gantry crane across the two towers: its trolley runs along the beam and lowers its hook, and the
    // tower lights blink in turn.
    const x = [64, 88, 112, 88][i];
    const drop = [0, 14, 20, 8][i];
    return onTop(
      svg,
      `<path d="M13 44 H179" stroke="#0f1a2e" stroke-width="5" /><path d="M13 44 H179" stroke="#f2c14e" stroke-width="3" />` +
        `<rect x="${x - 8}" y="39" width="16" height="10" rx="2" fill="#3a4656" stroke="#0f1a2e" stroke-width="2" />` +
        `<path d="M${x} 49 V${56 + drop}" stroke="#0f1a2e" stroke-width="1.6" />` +
        `<path d="M${x - 3} ${56 + drop} h6 v3 q0 4 -3 4 q-3 0 -3 -3" fill="none" stroke="#c9d2de" stroke-width="2" stroke-linecap="round" />` +
        [13, 179].map((cx, k) => `${(i + k) % 2 === 0 ? `<circle cx="${cx}" cy="38" r="5" fill="#ff5a4a" opacity="0.4" />` : ''}<circle cx="${cx}" cy="38" r="2.2" fill="${(i + k) % 2 === 0 ? '#ff8a7a' : '#6a2a22'}" />`).join(''),
    );
  },
};

/** Lays the frames side by side, each clipped to its own square, sharing the sprite's defs. */
function strip(base, frame) {
  const [, w, h] = /viewBox="0 0 (\d+) (\d+)"/.exec(base) ?? [];
  if (!w) throw new Error('no viewBox');
  const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const defs = /<defs>[\s\S]*?<\/defs>/.exec(base)?.[0] ?? '';
  const frames = [];
  for (let i = 0; i < FRAMES; i++) {
    const body = inner(frame(base, i)).replace(/<defs>[\s\S]*?<\/defs>/, '');
    frames.push(`<svg x="${i * w}" y="0" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="hidden">${body}</svg>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w * FRAMES} ${h}">${defs}${frames.join('')}</svg>\n`;
}

for (const [type, frame] of Object.entries(MACHINES)) {
  const base = readFileSync(join(ART, `${type}.svg`), 'utf8');
  writeFileSync(join(ART, `${type}_working_4f.svg`), strip(base, frame));
  console.log(`${type}_working_4f.svg`);
}
