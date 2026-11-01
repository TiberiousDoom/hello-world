// Ideas batch 4 (D-159): the engineer carrying, hammering and waving; the queens walking, lunging and calling
// a raid; fireflies; scaffolding round a building under repair; and the burnt-out ruin a lost building leaves.
// Run `node art/life.mjs` after redrawing the engineer or a queen.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ART = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'art');
const INK = '#0f1a2e';
const f1 = (n) => n.toFixed(1);
const TAU = Math.PI * 2;
const read = (key) => readFileSync(join(ART, `${key}.svg`), 'utf8');
const write = (key, s) => {
  writeFileSync(join(ART, `${key}.svg`), s);
  console.log(`${key}.svg`);
};
const inner = (s) => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const box = (s) => /viewBox="([^"]+)"/.exec(s)[1];
/** Square frames side by side, sharing `defs`; each frame's own ids get a suffix. */
const strip = (size, frames, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * frames.length} ${size}"><defs>${defs}</defs>\n` +
  frames
    .map((body, i) => {
      let s = body;
      for (const id of [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])) s = s.replaceAll(`id="${id}"`, `id="${id}-f${i}"`).replaceAll(`url(#${id})`, `url(#${id}-f${i})`);
      return `<svg x="${i * size}" y="0" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${s}</svg>`;
    })
    .join('\n') +
  '\n</svg>\n';

// --- The engineer: three strips from the idle strip's own pieces (its torso, boots, hands and hat).
{
  const idle = read('units/engineer_idle_4f');
  const defs = /<defs>([\s\S]*?)<\/defs>/.exec(idle)[1].replace(/<g id="enI\d">[\s\S]*?<\/g>/g, '');
  const boots = (step) => `<g stroke="${INK}" stroke-width="2.5"><rect x="${15 + step}" y="15" width="12" height="9" rx="4" fill="#3b4252" /><rect x="${15 - step}" y="40" width="12" height="9" rx="4" fill="#3b4252" /></g>`;
  const hand = (x, y) => `<rect x="${x}" y="${y}" width="10" height="7" rx="3" fill="#e9c39b" stroke="${INK}" stroke-width="2.5" />`;
  // Carrying a crate in both hands, a bob in its step.
  const crate = inner(read('buildings/crate'));
  write(
    'units/engineer_carry_4f',
    strip(
      64,
      [3, 0, -3, 0].map((step, i) => `${boots(step)}<g transform="translate(0 ${[0, -0.6, 0, -0.6][i]})"><use href="#enTorso" /><svg x="38" y="20" width="24" height="24" viewBox="0 0 64 64">${crate}</svg>${hand(38, 18)}${hand(38, 39)}<use href="#enHat" /></g>`),
      defs,
    ),
  );
  // Hammering: the hammer swings over from the shoulder and strikes, with a spark on the strike.
  write(
    'units/engineer_build_4f',
    strip(
      64,
      [-70, -35, 15, -10].map(
        (a, i) =>
          `<use href="#enBootN" /><use href="#enTorso" />${hand(36, 13)}` +
          `<g transform="rotate(${a} 36 44)"><path d="M38 47 H56" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" /><path d="M38 47 H56" stroke="#a87642" stroke-width="2.4" stroke-linecap="round" /><rect x="53" y="41" width="7" height="12" rx="1.5" fill="#8d99a6" stroke="${INK}" stroke-width="2" />${hand(36, 44)}</g>` +
          (i === 2 ? `<g stroke="#ffd36b" stroke-width="1.6" stroke-linecap="round"><path d="M58 50 l4 -3 M58 53 l5 1 M56 56 l2 4" /></g><circle cx="57" cy="52" r="2.2" fill="#fff4c0" />` : '') +
          `<use href="#enHat" />`,
      ),
      defs,
    ),
  );
  // Waving, for a player joining.
  write(
    'units/engineer_wave_4f',
    strip(
      64,
      [30, 36, 30, 24].map(
        (hx, i) =>
          `<use href="#enBootN" /><use href="#enTorso" />` +
          `<path d="M30 22 L${hx + 4} 9" stroke="#c8600e" stroke-width="5" stroke-linecap="round" />` +
          `<rect x="${hx}" y="3" width="9" height="9" rx="4" fill="#e9c39b" stroke="${INK}" stroke-width="2.5" />${hand(36, 44)}` +
          (i % 2 ? `<path d="M${hx - 3} 4 q-2 3 0 6 M${hx + 13} 4 q2 3 0 6" stroke="#ffffff" stroke-width="1.2" fill="none" opacity="0.8" />` : '') +
          `<use href="#enHat" transform="rotate(${[0, 8, 0, -8][i]} 33 32)" />`,
      ),
      defs,
    ),
  );
}

// --- Queens: a walk (a tripod gait, as for the beetle), a lunge to attack, and a summoning call, rings of
// scent going out, when her nest is roused. Their legs are paths of three points, drawn twice (ink, then colour).
for (const kind of ['crawler', 'runner', 'brute', 'wasp', 'beetle']) {
  const q = read(`enemies/${kind}_queen`);
  const vb = box(q);
  const c = Number(vb.split(' ')[2]) / 2;
  const legRe = /<path d="M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+)" fill="none"/g;
  const walk = (phase) => {
    const seen = new Map();
    return q.replace(legRe, (m, hx, hy, kx, ky, fx, fy) => {
      const key = `${hx},${hy}`;
      if (!seen.has(key)) seen.set(key, seen.size);
      const n = seen.get(key);
      const dx = ((n % 2) ^ (Math.floor(n / 2) % 2) ? 1 : -1) * 3.4 * Math.sin(phase);
      return `<path d="M${hx} ${hy} L${f1(+kx + dx * 0.55)} ${ky} L${f1(+fx + dx)} ${fy}" fill="none"`;
    });
  };
  const legs = [...q.matchAll(legRe)].length;
  // A queen with legs walks on them; one without (the wasp flies) bobs instead.
  const walkFrames = [0, 1, 2, 3].map((i) => (legs ? inner(walk((i / 4) * TAU + Math.PI / 2)) : `<g transform="translate(0 ${[0, -1, 0, 1][i]})">${inner(q)}</g>`));
  write(`enemies/${kind}_queen_walk_4f`, strip(Number(vb.split(' ')[2]), walkFrames));
  const lunge = [0, -3, 6, 2].map((dx, i) => `<g transform="translate(${dx} 0) translate(${c} ${c}) scale(${[1, 0.97, 1.05, 1][i]} ${[1, 1.03, 0.96, 1][i]}) translate(${-c} ${-c})">${inner(q)}</g>`);
  write(`enemies/${kind}_queen_attack_4f`, strip(Number(vb.split(' ')[2]), lunge));
  const summon = [0, 1, 2, 3].map((i) => {
    const rings = [0, 0.5]
      .map((o) => {
        const t = (i / 4 + o) % 1;
        return `<circle cx="${c}" cy="${c}" r="${f1(c * (0.45 + t * 0.5))}" fill="none" stroke="#ff4a3a" stroke-width="${f1(4.5 - t * 3)}" opacity="${f1(0.95 - t * 0.75)}" />`;
      })
      .join('');
    const k = [1, 1.06, 1.1, 1.04][i];
    return rings + `<g transform="translate(${c} ${c}) scale(${k}) translate(${-c} ${-c})">${inner(q)}</g>`;
  });
  write(`enemies/${kind}_queen_summon_4f`, strip(Number(vb.split(' ')[2]), summon));
}

// --- A firefly: a tiny beetle whose tail glows up and fades, wings flickering (32 × 32 frames).
write(
  'effects/firefly_4f',
  strip(
    32,
    [0.2, 0.7, 1, 0.4].map(
      (glow, i) =>
        `<circle cx="16" cy="16" r="${f1(6 + 6 * glow)}" fill="#e8ff7a" opacity="${f1(0.3 * glow)}" /><circle cx="16" cy="16" r="${f1(2 + 2 * glow)}" fill="#f4ffb0" opacity="${f1(0.4 + 0.6 * glow)}" />` +
        `<ellipse cx="13" cy="16" rx="3" ry="2" fill="#3a3020" stroke="${INK}" stroke-width="0.8" /><path d="M12 14 l-2 -3 M12 18 l-2 3" stroke="#dff2ff" stroke-width="1.2" opacity="${i % 2 ? 0.3 : 0.7}" />`,
    ),
  ),
);

// --- Scaffolding round a building under repair (laid over it, at its size), sparks where the work is.
write(
  'effects/scaffold_4f',
  strip(
    128,
    [0, 1, 2, 3].map(
      (i) =>
        `<g stroke="${INK}" stroke-width="5" stroke-linecap="round"><path d="M10 10 V118 M118 10 V118 M10 10 H118 M10 118 H118 M10 10 L118 118" /></g><g stroke="#c08a52" stroke-width="3" stroke-linecap="round"><path d="M10 10 V118 M118 10 V118 M10 10 H118 M10 118 H118 M10 10 L118 118" /></g>` +
        `<g fill="#d9a866" stroke="${INK}" stroke-width="1.6"><rect x="14" y="56" width="100" height="10" rx="2" /><rect x="56" y="14" width="10" height="44" rx="2" /></g>` +
        `<g fill="#c9d2de" stroke="${INK}" stroke-width="1.2"><circle cx="10" cy="10" r="3" /><circle cx="118" cy="10" r="3" /><circle cx="10" cy="118" r="3" /><circle cx="118" cy="118" r="3" /></g>` +
        (i % 2 ? `<g transform="translate(${i === 1 ? 86 : 30} 92)"><circle r="6" fill="#fff4c0" opacity="0.7" /><path d="M-8 -6 l4 3 M8 -6 l-4 3 M0 -9 v4 M-7 6 l4 -3 M7 6 l-4 -3" stroke="#ffd36b" stroke-width="2" stroke-linecap="round" /></g>` : ''),
    ),
  ),
);

// --- A burnt-out ruin where a building was lost to bugs: charred rubble, embers and a wisp of smoke.
{
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rubble = Array.from({ length: 14 }, () => [14 + rnd() * 100, 14 + rnd() * 100, 4 + rnd() * 9, rnd() * 180]);
  const embers = Array.from({ length: 7 }, () => [20 + rnd() * 88, 20 + rnd() * 88]);
  write(
    'effects/ruin_4f',
    strip(
      128,
      [0, 1, 2, 3].map((i) => {
        let s = `<rect x="12" y="12" width="104" height="104" rx="12" fill="#1e1a18" opacity="0.75" /><rect x="22" y="22" width="84" height="84" rx="8" fill="#2a2522" opacity="0.8" />`;
        for (const [x, y, sz, a] of rubble) s += `<rect x="${f1(x - sz / 2)}" y="${f1(y - sz / 3)}" width="${f1(sz)}" height="${f1(sz * 0.6)}" rx="1.5" transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})" fill="#3a3430" stroke="${INK}" stroke-width="1.2" />`;
        embers.forEach(([x, y], k) => {
          const on = (k + i) % 3 === 0;
          s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.6" fill="${on ? '#ff8a2a' : '#7a2a10'}" />` + (on ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="7" fill="#ff5a1a" opacity="0.3" />` : '');
        });
        for (let k = 0; k < 3; k++) {
          const t = ((i + k * 1.3) % 4) / 4;
          s += `<circle cx="${f1(40 + k * 25 + t * 12)}" cy="${f1(70 - t * 56)}" r="${f1(6 + t * 12)}" fill="#5a5a5e" opacity="${f1(0.5 - t * 0.42)}" />`;
        }
        return s;
      }),
    ),
  );
}
