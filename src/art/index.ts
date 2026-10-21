// Art loader. Every image under src/art/ is picked up automatically and keyed
// by its path without the extension, e.g. 'items/iron_plate'. A .png wins
// over a .svg with the same name, so final art drops in beside the
// placeholders without code changes. Missing sprites fall back to shapes
// drawn in code.

const files = import.meta.glob<string>('./**/*.{svg,png}', { eager: true, query: '?url', import: 'default' });

const urls = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const key = path.replace(/^\.\//, '').replace(/\.(svg|png)$/, '');
  if (path.endsWith('.png') || !urls.has(key)) urls.set(key, url);
}

/** Pixels per tile that sprites are pre-rendered at. */
const PX_PER_TILE = 128;
/** Sprites bigger than one tile: [width, height] in tiles, as drawn facing east. */
const TILES: Record<string, [number, number]> = {
  'buildings/hub': [5, 5],
  'buildings/extractor': [2, 2],
  'buildings/furnace': [2, 2],
  'buildings/workshop': [3, 2],
  'buildings/assembler': [4, 2],
  'buildings/lumber_camp': [2, 2],
  'buildings/sawmill': [2, 2],
  'buildings/shipyard': [3, 3],
  'buildings/ship_hull': [3, 3],
  'buildings/ship_engine': [3, 3],
  'buildings/ship_life': [3, 3],
  'buildings/ship_nav': [3, 3],
  'terrain/tree_round': [2, 2],
  'terrain/tree_autumn': [2, 2],
  'terrain/tree_pine': [2, 2],
  'terrain/bush': [2, 2],
};
const cache = new Map<string, HTMLCanvasElement>();

/** URL for use in HTML (toolbar, menus). */
export function artUrl(key: string): string | undefined {
  return urls.get(key);
}

/** A pre-rendered sprite for the canvas, if it exists and has loaded. */
export function sprite(key: string): HTMLCanvasElement | undefined {
  return cache.get(key);
}

/**
 * Loads and pre-renders every map sprite once, so drawing is a cheap image
 * copy instead of rasterising SVG every frame. UI icons are only used in HTML.
 */
export async function loadArt(): Promise<void> {
  const jobs = [...urls].filter(([key]) => !key.startsWith('ui/'));
  await Promise.all(
    jobs.map(
      ([key, url]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const unit = key.startsWith('items/') ? PX_PER_TILE / 2 : PX_PER_TILE;
            const [tw, th] = TILES[key] ?? [1, 1];
            const canvas = document.createElement('canvas');
            canvas.width = unit * tw;
            canvas.height = unit * th;
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            cache.set(key, canvas);
            resolve();
          };
          img.onerror = () => {
            console.warn(`Could not load art: ${key}`);
            resolve();
          };
          img.src = url;
        }),
    ),
  );
}

const iconSources = import.meta.glob<string>('./ui/*.svg', { eager: true, query: '?raw', import: 'default' });

/** Inline SVG markup for a UI icon, so it takes the surrounding text colour. */
export function icon(name: string): string {
  return iconSources[`./ui/${name}.svg`] ?? '';
}
