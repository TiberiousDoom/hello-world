// The ship from the side (D-098, D-109): what the shipyard's window shows. On the map the ship is drawn
// top-down like everything else; here each stage is a part of the ship, solid once built, filling in
// while its parts arrive, and a dashed outline until then.

import { ItemId, SHIP } from '../sim/data';
import type { World } from '../sim/world';

/** How far along each stage is: 1 built, 0–1 in progress, 0 not started. */
export function stageProgress(world: World): number[] {
  const ship = world.state.ship;
  return SHIP.stages.map((st, i) => {
    if (i < ship.stage) return 1;
    if (i > ship.stage) return 0;
    const need = Object.values(st.items).reduce((a, n) => a + n!, 0);
    const have = Object.entries(st.items).reduce((a, [k, n]) => a + Math.min(n!, ship.delivered[k as ItemId] ?? 0), 0);
    return need ? have / need : 0;
  });
}

/** Each stage's drawing, in a 200×260 box with the ground at y = 240. */
const PARTS: Record<string, { fill: string; shapes: string }> = {
  scaffold: {
    fill: '#b07a3c',
    shapes:
      '<rect x="38" y="40" width="10" height="200"/><rect x="152" y="40" width="10" height="200"/>' +
      '<path d="M48 70 L152 110 M48 110 L152 70 M48 150 L152 190 M48 190 L152 150 M48 228 H152 M48 40 H70 M130 40 H152" stroke-width="5" fill="none"/>',
  },
  hull: { fill: '#8fa3b8', shapes: '<rect x="76" y="80" width="48" height="140" rx="10"/>' },
  engine: { fill: '#5d6a86', shapes: '<path d="M80 220 H120 L128 240 H72 Z"/><rect x="62" y="190" width="14" height="40" rx="4"/><rect x="124" y="190" width="14" height="40" rx="4"/>' },
  life: { fill: '#7bd88f', shapes: '<circle cx="100" cy="115" r="9"/><circle cx="100" cy="145" r="9"/><circle cx="100" cy="175" r="9"/>' },
  nav: { fill: '#f2c14e', shapes: '<path d="M76 82 Q100 20 124 82 Z"/><rect x="98" y="14" width="4" height="22"/><circle cx="100" cy="12" r="4"/>' },
};

/** The side view and a list of the stages, as HTML. */
export function shipSideView(world: World): string {
  const progress = stageProgress(world);
  // Scaffolding first, behind; then the ship from the bottom up.
  const order = ['scaffold', 'engine', 'hull', 'life', 'nav'];
  const parts = order
    .map((id) => {
      const i = SHIP.stages.findIndex((s) => s.id === id);
      const part = PARTS[id];
      if (i < 0 || !part) return '';
      const p = progress[i];
      const stroke = id === 'scaffold' ? part.fill : '#0f1a2e';
      if (p >= 1) return `<g fill="${part.fill}" stroke="${stroke}" stroke-width="2">${part.shapes}</g>`;
      const ghost = `<g fill="none" stroke="#7d8aa3" stroke-width="1.5" stroke-dasharray="5 4">${part.shapes}</g>`;
      return p > 0 ? `${ghost}<g fill="${part.fill}" stroke="${stroke}" stroke-width="2" opacity="${(0.25 + 0.6 * p).toFixed(2)}">${part.shapes}</g>` : ghost;
    })
    .join('');
  const svg =
    `<svg class="ship-side" viewBox="0 0 200 260" role="img" aria-label="The ship from the side">` +
    `<rect x="0" y="240" width="200" height="20" fill="#3a2a1c"/><path d="M0 240 H200" stroke="#6b4423" stroke-width="2"/>${parts}</svg>`;
  const list = SHIP.stages
    .map((st, i) => {
      const p = progress[i];
      const state = p >= 1 ? 'Built' : p > 0 ? `${Math.floor(p * 100)}%` : i === world.state.ship.stage ? 'Next' : 'Later';
      return `<li class="${p >= 1 ? 'done' : i === world.state.ship.stage ? 'now' : ''}"><span>${st.name}</span><span>${state}</span></li>`;
    })
    .join('');
  return `${svg}<ol class="ship-stages">${list}</ol>`;
}
