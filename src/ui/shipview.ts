// The ship from the side (D-098, D-109, D-151): what the shipyard's window shows. On the map the ship is
// drawn top-down like everything else; here each stage is a part of the ship, solid once built, filling in
// while its parts arrive, and a dashed outline (its silhouette) until then. Drawn in a 200×260 box with the
// ground at y = 240; light from the top-left and one ink outline, as on the map.

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

const INK = '#0f1a2e';

/** Gradients the parts use; `p` prefixes their ids, so they can't clash with anything else on the page. */
const defs = (p: string): string => `<defs>
<linearGradient id="${p}hull" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" /><stop offset="0.35" stop-color="#e3eaf3" /><stop offset="0.8" stop-color="#a9b7c8" /><stop offset="1" stop-color="#7d8ca0" /></linearGradient>
<linearGradient id="${p}navy" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a64a8" /><stop offset="0.45" stop-color="#1d3b6e" /><stop offset="1" stop-color="#132848" /></linearGradient>
<linearGradient id="${p}steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9d2de" /><stop offset="0.5" stop-color="#7d8a9c" /><stop offset="1" stop-color="#3e4858" /></linearGradient>
<linearGradient id="${p}bell" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a96a8" /><stop offset="0.4" stop-color="#4a5466" /><stop offset="1" stop-color="#1e2430" /></linearGradient>
<linearGradient id="${p}wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9a86a" /><stop offset="1" stop-color="#8a5a30" /></linearGradient>
<linearGradient id="${p}brick" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b56a48" /><stop offset="1" stop-color="#7a4430" /></linearGradient>
<radialGradient id="${p}glass" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#e8fff0" /><stop offset="0.4" stop-color="#7bd88f" /><stop offset="1" stop-color="#2a6b3a" /></radialGradient>
<radialGradient id="${p}cockpit" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff" /><stop offset="0.35" stop-color="#bfe4ff" /><stop offset="1" stop-color="#2a6aa8" /></radialGradient>
<radialGradient id="${p}flame" cx="50%" cy="10%" r="90%"><stop offset="0" stop-color="#ffffff" /><stop offset="0.25" stop-color="#fff3b0" /><stop offset="0.6" stop-color="#ffb347" /><stop offset="1" stop-color="#ff6a2a" stop-opacity="0" /></radialGradient>
<radialGradient id="${p}smoke" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#e8e4dc" /><stop offset="1" stop-color="#9a958c" /></radialGradient>
</defs>`;

/** Each stage's drawing, and its silhouette alone for the dashed outline. */
const PARTS: Record<string, (p: string) => { ghost: string; art: string }> = {
  // The Iron Age's launch pad (D-118): a brick slab, an iron blast plate, a flame trench under the engine.
  pad: (p) => ({
    ghost: '<path d="M14 240 V226 L22 220 H178 L186 226 V240 Z" />',
    art: `<g stroke="${INK}" stroke-linejoin="round">
<path d="M14 240 V226 L22 220 H178 L186 226 V240 Z" fill="url(#${p}brick)" stroke-width="2.2" />
<path d="M16 230 H184 M22 220 V226 M42 226 V240 M70 226 V240 M130 226 V240 M158 226 V240 M30 230 V240 M56 230 V240 M144 230 V240 M170 230 V240" fill="none" stroke="#5e3222" stroke-width="1" />
<path d="M24 222 H176" stroke="#d58a66" stroke-width="1.2" stroke-linecap="round" />
<rect x="58" y="214" width="84" height="8" rx="1.5" fill="url(#${p}steel)" stroke-width="2" />
<g fill="#3e4858" stroke="none"><circle cx="63" cy="218" r="1.2" /><circle cx="73" cy="218" r="1.2" /><circle cx="127" cy="218" r="1.2" /><circle cx="137" cy="218" r="1.2" /></g>
<path d="M84 214 V222 H116 V214" fill="#1b1f28" stroke-width="1.6" />
<g fill="#f2c14e" stroke="none"><path d="M22 220 l6 0 l-6 6 z M178 220 l-6 0 l6 6 z" /></g>
</g>`,
  }),

  // The Wood Age's scaffolding (D-109): two timber towers braced with crosses, gantry arms reaching in at
  // three levels, a ladder, and a small crane on top with a rope and hook.
  scaffold: (p) => ({
    ghost: '<path d="M30 220 V44 H50 V220 Z M150 220 V36 H170 V220 Z M50 84 H74 M50 134 H74 M50 184 H72 M150 84 H126 M150 134 H126 M150 184 H128 M160 36 V22 H110" />',
    art: `<g stroke="${INK}" stroke-linejoin="round" stroke-linecap="round">
<g fill="none" stroke-width="5"><path d="M32 60 L48 100 M48 60 L32 100 M32 110 L48 150 M48 110 L32 150 M32 160 L48 200 M48 160 L32 200 M152 60 L168 100 M168 60 L152 100 M152 110 L168 150 M168 110 L152 150 M152 160 L168 200 M168 160 L152 200" /></g>
<g fill="none" stroke="#a87642" stroke-width="2.6"><path d="M32 60 L48 100 M48 60 L32 100 M32 110 L48 150 M48 110 L32 150 M32 160 L48 200 M48 160 L32 200 M152 60 L168 100 M168 60 L152 100 M152 110 L168 150 M168 110 L152 150 M152 160 L168 200 M168 160 L152 200" /></g>
<g fill="url(#${p}wood)" stroke-width="2">
<rect x="28" y="44" width="6" height="176" rx="1.5" /><rect x="46" y="44" width="6" height="176" rx="1.5" />
<rect x="148" y="36" width="6" height="184" rx="1.5" /><rect x="166" y="36" width="6" height="184" rx="1.5" />
<rect x="26" y="40" width="28" height="6" rx="1.5" /><rect x="146" y="32" width="28" height="6" rx="1.5" />
<rect x="26" y="82" width="50" height="5" rx="1.5" /><rect x="26" y="132" width="50" height="5" rx="1.5" /><rect x="26" y="182" width="48" height="5" rx="1.5" />
<rect x="124" y="82" width="50" height="5" rx="1.5" /><rect x="124" y="132" width="50" height="5" rx="1.5" /><rect x="126" y="182" width="48" height="5" rx="1.5" />
</g>
<g fill="none" stroke="#f0c890" stroke-width="0.9" opacity="0.8"><path d="M29.5 48 V216 M149.5 40 V216" /></g>
<g fill="none" stroke="#5e3d1d" stroke-width="1.6"><path d="M20 44 V220 M26 44 V220 M20 56 H26 M20 72 H26 M20 88 H26 M20 104 H26 M20 120 H26 M20 136 H26 M20 152 H26 M20 168 H26 M20 184 H26 M20 200 H26 M20 216 H26" /></g>
<g fill="none" stroke="#d6bf86" stroke-width="1.4"><path d="M70 82 l4 -4 M70 87 l4 4 M130 82 l-4 -4 M130 87 l-4 4 M70 132 l4 -4 M130 132 l-4 -4" /></g>
<path d="M160 32 V18 H106" fill="none" stroke-width="4" /><path d="M160 32 V18 H106" fill="none" stroke="#a87642" stroke-width="2" />
<path d="M160 22 L150 18" fill="none" stroke="#a87642" stroke-width="1.6" />
<path d="M110 18 V34" fill="none" stroke="#d6bf86" stroke-width="1.2" /><path d="M107 34 q3 6 6 0" fill="none" stroke="#3e4858" stroke-width="1.6" />
<circle cx="110" cy="19" r="2.2" fill="#3e4858" stroke-width="1" />
</g>`,
  }),

  // The Electric Age's engine (D-130): a thrust section, a main bell, two booster pods and the fins.
  engine: (p) => ({
    ghost:
      '<path d="M74 186 H126 V206 L132 222 H68 L74 206 Z M56 214 V156 Q64 144 72 156 V214 Z M128 214 V156 Q136 144 144 156 V214 Z M74 168 L48 210 H74 Z M126 168 L152 210 H126 Z M78 180 L62 218 H80 Z M122 180 L138 218 H120 Z" />',
    art: `<g stroke="${INK}" stroke-linejoin="round">
<path d="M74 166 L46 208 Q46 212 50 212 H74 Z" fill="url(#${p}navy)" stroke-width="2" /><path d="M126 166 L154 208 Q154 212 150 212 H126 Z" fill="url(#${p}navy)" stroke-width="2" />
<path d="M70 176 L52 204" stroke="#6f9ad8" stroke-width="1.2" stroke-linecap="round" fill="none" />
<path d="M56 212 V158 Q64 144 72 158 V212 Z" fill="url(#${p}hull)" stroke-width="2" /><path d="M128 212 V158 Q136 144 144 158 V212 Z" fill="url(#${p}hull)" stroke-width="2" />
<path d="M56 168 H72 M128 168 H144" stroke="#1d3b6e" stroke-width="3" /><path d="M58 160 Q62 152 66 152" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" />
<path d="M58 212 L56 222 H72 L70 212 Z M130 212 L128 222 H144 L142 212 Z" fill="url(#${p}bell)" stroke-width="1.8" />
<path d="M78 180 L62 214 Q61 219 66 219 H80 Z" fill="url(#${p}navy)" stroke-width="2" /><path d="M122 180 L138 214 Q139 219 134 219 H120 Z" fill="url(#${p}navy)" stroke-width="2" />
<path d="M76 188 L66 210" stroke="#6f9ad8" stroke-width="1.2" stroke-linecap="round" fill="none" />
<rect x="74" y="186" width="52" height="22" rx="2" fill="url(#${p}steel)" stroke-width="2" />
<g fill="#2a2f3c" stroke="none"><rect x="80" y="191" width="3" height="12" rx="1" /><rect x="86" y="191" width="3" height="12" rx="1" /><rect x="111" y="191" width="3" height="12" rx="1" /><rect x="117" y="191" width="3" height="12" rx="1" /></g>
<circle cx="100" cy="197" r="5" fill="#3fa9f5" stroke-width="1.6" /><circle cx="98.5" cy="195.5" r="1.6" fill="#e8f6ff" stroke="none" />
<path d="M84 208 L76 224 H124 L116 208 Z" fill="url(#${p}bell)" stroke-width="2" />
<path d="M80 216 H120" stroke="#8a96a8" stroke-width="1" fill="none" /><path d="M84 210 L78 222" stroke="#c9d2de" stroke-width="1.2" stroke-linecap="round" fill="none" />
</g>`,
  }),

  // The Steam Age's hull (D-124): a steel fuselage, panel lines and rivets, navy bands and a hazard stripe.
  hull: (p) => ({
    ghost: '<path d="M74 186 V80 Q74 70 84 68 H116 Q126 70 126 80 V186 Z" />',
    art: `<g stroke="${INK}" stroke-linejoin="round">
<path d="M74 188 V80 Q74 70 84 68 H116 Q126 70 126 80 V188 Z" fill="url(#${p}hull)" stroke-width="2.4" />
<rect x="74" y="86" width="52" height="7" fill="url(#${p}navy)" stroke-width="1.6" />
<rect x="74" y="168" width="52" height="7" fill="url(#${p}navy)" stroke-width="1.6" />
<g fill="#f2c14e" stroke-width="1.2"><rect x="74" y="180" width="52" height="6" /></g>
<g fill="#0f1a2e" stroke="none"><path d="M78 180 l4 0 l-4 6 z M88 180 l6 0 l-4 6 h-6 z M100 180 l6 0 l-4 6 h-6 z M112 180 l6 0 l-4 6 h-6 z M124 180 l2 0 v3 z" /></g>
<g fill="none" stroke="#8d9bb0" stroke-width="0.9"><path d="M74 118 H126 M74 146 H126 M100 93 V168" /></g>
<g fill="#7d8ca0" stroke="none"><circle cx="78" cy="100" r="0.9" /><circle cx="78" cy="112" r="0.9" /><circle cx="78" cy="124" r="0.9" /><circle cx="78" cy="136" r="0.9" /><circle cx="78" cy="152" r="0.9" /><circle cx="78" cy="162" r="0.9" /><circle cx="122" cy="100" r="0.9" /><circle cx="122" cy="112" r="0.9" /><circle cx="122" cy="124" r="0.9" /><circle cx="122" cy="136" r="0.9" /><circle cx="122" cy="152" r="0.9" /><circle cx="122" cy="162" r="0.9" /></g>
<path d="M80 74 Q80 70 86 70" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />
<path d="M79 96 V166" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8" fill="none" />
<text x="117" y="138" font-family="Montserrat, system-ui, sans-serif" font-weight="800" font-size="8" fill="#1d3b6e" stroke="none" text-anchor="middle" transform="rotate(-90 117 138)">FF-1</text>
</g>`,
  }),

  // Life support (D-130): portholes lit green, the crew hatch, and two oxygen tanks strapped to the hull.
  life: (p) => ({
    ghost:
      '<circle cx="100" cy="106" r="8" /><circle cx="100" cy="130" r="8" /><path d="M90 148 H110 V164 H90 Z M66 116 Q66 108 72 108 H74 V154 H72 Q66 154 66 146 Z M134 116 Q134 108 128 108 H126 V154 H128 Q134 154 134 146 Z" />',
    art: `<g stroke="${INK}" stroke-linejoin="round">
<path d="M66 116 Q66 108 72 108 H74 V154 H72 Q66 154 66 146 Z" fill="url(#${p}hull)" stroke-width="1.8" /><path d="M134 116 Q134 108 128 108 H126 V154 H128 Q134 154 134 146 Z" fill="url(#${p}hull)" stroke-width="1.8" />
<path d="M66 116 H74 M126 116 H134" stroke="#2f8a48" stroke-width="3" /><path d="M66 140 H74 M126 140 H134" stroke="#3e4858" stroke-width="1.6" />
<g fill="url(#${p}steel)" stroke-width="1.8"><circle cx="100" cy="106" r="8.5" /><circle cx="100" cy="130" r="8.5" /></g>
<g fill="url(#${p}glass)" stroke-width="1.2"><circle cx="100" cy="106" r="5.6" /><circle cx="100" cy="130" r="5.6" /></g>
<g fill="#ffffff" stroke="none" opacity="0.85"><circle cx="98" cy="104" r="1.4" /><circle cx="98" cy="128" r="1.4" /></g>
<rect x="90" y="146" width="20" height="18" rx="3" fill="url(#${p}steel)" stroke-width="1.8" />
<rect x="93" y="149" width="14" height="12" rx="2" fill="#c9d2de" stroke-width="1" /><path d="M95 155 H101" stroke="#3e4858" stroke-width="1.6" stroke-linecap="round" fill="none" />
<circle cx="105" cy="151.5" r="1.2" fill="#7bd88f" stroke="none" />
</g>`,
  }),

  // Navigation (D-130): the nose cone with its cockpit glass, a radar dish, an antenna and a beacon on top.
  nav: (p) => ({
    ghost: '<path d="M76 70 Q76 42 100 22 Q124 42 124 70 Z M99 22 V8 M100 6 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 M124 56 L136 48" />',
    art: `<g stroke="${INK}" stroke-linejoin="round" stroke-linecap="round">
<path d="M124 58 L136 50" fill="none" stroke-width="2.6" /><path d="M124 58 L136 50" fill="none" stroke="#c9d2de" stroke-width="1.2" />
<path d="M132 44 Q142 46 140 56 Z" fill="url(#${p}steel)" stroke-width="1.6" />
<path d="M100 22 V8" fill="none" stroke-width="3" /><path d="M100 22 V8" fill="none" stroke="#c9d2de" stroke-width="1.4" />
<path d="M96 14 H104" fill="none" stroke-width="2.4" /><path d="M96 14 H104" fill="none" stroke="#c9d2de" stroke-width="1" />
<circle cx="100" cy="6" r="3.4" fill="#f2c14e" stroke-width="1.4" /><circle cx="99" cy="5" r="1" fill="#ffffff" stroke="none" />
<path d="M76 70 Q76 42 100 22 Q124 42 124 70 Z" fill="url(#${p}navy)" stroke-width="2.4" />
<path d="M82 62 Q83 44 98 28" fill="none" stroke="#6f9ad8" stroke-width="2" opacity="0.9" />
<path d="M88 56 Q100 42 112 56 Q100 60 88 56 Z" fill="url(#${p}cockpit)" stroke-width="1.6" />
<path d="M93 52 Q97 48 101 47" fill="none" stroke="#ffffff" stroke-width="1.4" opacity="0.9" />
<path d="M76 66 H124" stroke="#f2c14e" stroke-width="2.4" fill="none" />
</g>`,
  }),
};

/** The side view and a list of the stages, as HTML. */
export function shipSideView(world: World): string {
  const progress = stageProgress(world);
  const p = 'sv-';
  // The pad and scaffolding first, behind; then the ship from the bottom up.
  const order = ['pad', 'scaffold', 'engine', 'hull', 'life', 'nav'];
  const parts = order
    .map((id) => {
      const i = SHIP.stages.findIndex((s) => s.id === id);
      const part = PARTS[id]?.(p);
      if (i < 0 || !part) return '';
      const v = progress[i];
      if (v >= 1) return part.art;
      const ghost = `<g fill="none" stroke="#7d8aa3" stroke-width="1.5" stroke-dasharray="5 4">${part.ghost}</g>`;
      return v > 0 ? `${ghost}<g opacity="${(0.25 + 0.6 * v).toFixed(2)}">${part.art}</g>` : ghost;
    })
    .join('');
  const svg =
    `<svg class="ship-side" viewBox="0 0 200 260" role="img" aria-label="The ship from the side">${defs(p)}` +
    `<rect x="0" y="240" width="200" height="20" fill="#3a2a1c"/><path d="M0 240 H200" stroke="#6b4423" stroke-width="2"/>${parts}</svg>`;
  const list = SHIP.stages
    .map((st, i) => {
      const v = progress[i];
      const state = v >= 1 ? 'Built' : v > 0 ? `${Math.floor(v * 100)}%` : i === world.state.ship.stage ? 'Next' : 'Later';
      return `<li class="${v >= 1 ? 'done' : i === world.state.ship.stage ? 'now' : ''}"><span>${st.name}</span><span>${state}</span></li>`;
    })
    .join('');
  return `${svg}<ol class="ship-stages">${list}</ol>`;
}
