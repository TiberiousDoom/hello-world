// Shared pieces for the "Ideas" boards: reading the game's sprites, changing them frame by frame, and laying
// a board out (the sprite now, its frames, and the frames played).
import fs from 'node:fs';
import path from 'node:path';

export const REPO = process.argv[2] ?? '.';
export const OUT = process.argv[3] ?? 'out';
export const INK = '#0f1a2e';
export const GRASS = '#2e4d33';

/** A sprite from src/art, by key ('buildings/greenhouse'). */
export const read = (key) => fs.readFileSync(path.join(REPO, 'src/art', `${key}.svg`), 'utf8');
export const uri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

/** Replaces `find`, which must occur exactly once, so a redrawn sprite fails loudly instead of animating the wrong part. */
export function swap(svg, find, replace, what = '') {
  const n = svg.split(find).length - 1;
  if (n !== 1) throw new Error(`${what}: expected one match for ${JSON.stringify(find.slice(0, 70))}, found ${n}`);
  return svg.replace(find, replace);
}
/** Adds markup on top of a sprite. */
export const over = (svg, extra) => svg.replace(/<\/svg>\s*$/, `${extra}</svg>`);
/** Adds markup under a sprite (after its defs). */
export const under = (svg, extra) => svg.replace(/(<svg[^>]*>)/, `$1${extra}`);
/** The sprite's markup without its root element, and its viewBox. */
export const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
export const box = (svg) => svg.match(/viewBox="([^"]+)"/)[1];
/** A new sprite from markup, in a viewBox. */
export const make = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
/** Wraps everything in the sprite (but its defs) in a group, e.g. to filter or move it. */
export function group(svg, attrs) {
  const body = inner(svg);
  const defs = [...body.matchAll(/<defs>[\s\S]*?<\/defs>/g)].map((m) => m[0]).join('');
  return make(box(svg), `${defs}<g ${attrs}>${body.replace(/<defs>[\s\S]*?<\/defs>/g, '')}</g>`);
}

/** A seeded random number generator, so the boards come out the same every run. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Layout ---

const tile = (bg) => `background: ${bg}; border-radius: 10px; padding: 8px; display: flex; align-items: center; justify-content: center`;
/** One sprite on its ground. */
export const still = (svg, size = 128, bg = GRASS) => `<div style="${tile(bg)}"><img src="${uri(svg)}" width="${size}" height="${size * aspect(svg)}" style="display: block"></div>`;
const aspect = (svg) => {
  const [, , w, h] = box(svg).split(/\s+/).map(Number);
  return h / w;
};
/** The frames played in a loop, each held for 1/fps of a second. */
export function play(frames, fps = 8, size = 128, bg = GRASS) {
  const n = frames.length;
  const dur = n / fps;
  const [, , w, h] = box(frames[0]).split(/\s+/).map(Number);
  const imgs = frames
    .map((f, i) => {
      const values = frames.map((_, j) => (j === i ? 1 : 0)).join(';');
      return `<image href="${uri(f)}" width="${w}" height="${h}" opacity="${i === 0 ? 1 : 0}"><animate attributeName="opacity" values="${values}" dur="${dur}s" calcMode="discrete" repeatCount="indefinite" /></image>`;
    })
    .join('');
  return `<div style="${tile(bg)}"><svg viewBox="0 0 ${w} ${h}" width="${size}" height="${(size * h) / w}" style="display: block">${imgs}</svg></div>`;
}
/** The frames side by side, numbered. */
export const frames = (list, size = 72, bg = GRASS) =>
  `<div style="display: flex; gap: 6px; flex-wrap: wrap">${list
    .map((f, i) => `<div style="display: flex; flex-direction: column; gap: 3px; align-items: center">${still(f, size, bg)}<div style="font-size: 11px; color: #7f8ea3">${i + 1}</div></div>`)
    .join('')}</div>`;
const label = (t) => `<div style="font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #7f8ea3; font-weight: 700">${t}</div>`;
const col = (t, inner) => `<div style="display: flex; flex-direction: column; gap: 6px">${label(t)}${inner}</div>`;

/**
 * One idea: a title, a sentence or two, and columns of art. `cols` is a list of [label, html] (the helpers
 * above make the html), or a list of such lists for several rows.
 */
export const idea = (title, sub, cols, tag = '') =>
  `<div style="background: #18233a; border-radius: 14px; padding: 20px 22px; display: flex; flex-direction: column; gap: 14px">
<div style="display: flex; flex-direction: column; gap: 4px"><div style="display: flex; gap: 10px; align-items: baseline"><div style="font-weight: 800; font-size: 19px; color: #ffffff; font-family: Montserrat, system-ui, sans-serif">${title}</div>${tag ? `<div style="font-size: 12px; color: #f2c14e; font-weight: 700">${tag}</div>` : ''}</div>
<div style="font-size: 13.5px; line-height: 1.5; color: #a9b6c9; max-width: 1240px">${sub}</div></div>
${(Array.isArray(cols[0][0]) ? cols : [cols]).map((r) => `<div style="display: flex; gap: 22px; align-items: flex-start; flex-wrap: wrap">${r.map(([t, h]) => col(t, h)).join('')}</div>`).join('')}</div>`;

/** A whole board. */
export function board(file, { title, kicker, heading, intro, ideas }) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&amp;display=swap" rel="stylesheet">
<style>body{margin:0}</style>
</helmet>
<div style="width: 1440px; box-sizing: border-box; padding: 56px 64px; background: #121a28; color: #e6edf7; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; display: flex; flex-direction: column; gap: 22px">
<div style="display: flex; flex-direction: column; gap: 8px">
<div style="font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: #f2c14e; font-weight: 700">${kicker}</div>
<h1 style="margin: 0; font-family: Montserrat, system-ui, sans-serif; font-weight: 800; font-size: 40px; color: #ffffff">${heading}</h1>
<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #a9b6c9; max-width: 1180px">${intro}</p>
</div>
${ideas.join('\n')}
</div>
</x-dc>
</body>
</html>`;
  fs.mkdirSync(path.join(OUT, 'project'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'project', file), html);
  console.log(file, Math.round(html.length / 1024), 'KB');
}
