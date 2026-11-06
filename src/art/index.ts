// Art loader. Every image under src/art/ is picked up automatically and keyed
// by its path without the extension, e.g. 'items/iron_plate'. A .png wins
// over a .svg with the same name, so final art drops in beside the
// placeholders without code changes. Missing sprites fall back to shapes
// drawn in code.
//
// An animation is a strip: square frames side by side, named with the frame count, e.g.
// 'enemies/crawler_walk_4f'. It's cut into frames on loading and read with frame('enemies/crawler_walk', i)
// (D-082).

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
  'buildings/hub': [8, 8],
  'buildings/hub_damaged': [8, 8],
  // Each nest kind's stages and queen nest (D-152), drawn in a 4-tile box: the art grows inside it.
  ...Object.fromEntries(['warren', 'runnel', 'hive', 'den', 'barrow'].flatMap((k) => ['1', '2', '3', 'queen'].map((s) => [`nests/${k}_${s}`, [4, 4] as [number, number]]))),
  // The glow in a Hardcore nest's burrows (D-158), laid over the nest.
  ...Object.fromEntries(['warren', 'runnel', 'hive', 'den', 'barrow'].flatMap((k) => ['1', '2', '3', 'queen'].map((s) => [`nests/${k}_${s}_glow`, [4, 4] as [number, number]]))),
  // Mk2 and Mk3 plates (D-158): 64 × 56.
  'effects/plate_mk2': [1, 0.875],
  'effects/plate_mk2_off': [1, 0.875],
  'effects/plate_mk3': [1, 0.875],
  'effects/plate_mk3_off': [1, 0.875],
  // Queens (D-152) are drawn about one and a half tiles across.
  ...Object.fromEntries(['crawler', 'runner', 'brute', 'wasp', 'beetle'].map((b) => [`enemies/${b}_queen`, [2, 2] as [number, number]])),
  // Their walk, attack and summoning strips (D-159).
  ...Object.fromEntries(['crawler', 'runner', 'brute', 'wasp', 'beetle'].flatMap((b) => ['walk', 'attack', 'summon'].map((a) => [`enemies/${b}_queen_${a}`, [2, 2] as [number, number]]))),
  'nests/angry': [2, 2],
  'nests/damaged': [2, 2],
  'nests/destroyed': [2, 2],
  'buildings/extractor': [2, 2],
  'buildings/furnace': [2, 2],
  'buildings/workshop': [2, 2],
  'buildings/blacksmith': [2, 2],
  'buildings/well': [2, 2],
  'buildings/water_wheel': [3, 1],
  'buildings/machine_shop': [2, 2],
  'buildings/steel_works': [2, 2],
  'buildings/circuit_works': [2, 2],
  'buildings/greenhouse': [2, 2],
  'buildings/tree_nursery': [2, 2],
  'buildings/powder_mill': [2, 2],
  'buildings/boiler': [2, 2],
  'buildings/storage_silo': [2, 2],
  // How full a store is (D-157): its sprite at a third, two thirds and full.
  'buildings/storage_silo_1': [2, 2],
  'buildings/storage_silo_2': [2, 2],
  'buildings/storage_silo_3': [2, 2],
  'buildings/steam_turbine': [2, 2],
  'buildings/assembler': [3, 3],
  'buildings/splitter': [1, 2],
  'buildings/storage': [1, 2],
  'buildings/storage_1': [1, 2],
  'buildings/storage_2': [1, 2],
  'buildings/storage_3': [1, 2],
  'buildings/lumber_camp': [2, 2],
  'buildings/sawmill': [2, 2],
  'buildings/trebuchet_base': [2, 2],
  'buildings/trebuchet_barrel': [2, 2],
  'buildings/trebuchet_barrel_fire': [2, 2],
  'buildings/artillery_base': [2, 2],
  'buildings/artillery_barrel': [2, 2],
  'buildings/artillery_barrel_fire': [2, 2],
  'buildings/railgun_base': [2, 2],
  'buildings/railgun_barrel': [2, 2],
  'buildings/railgun_barrel_charge': [2, 2],
  // The tesla's bolt (D-157): four times as long as it's wide, stretched from the tesla to its target.
  'effects/tesla_bolt': [4, 1],
  // Eyes at the forest's edge (D-160): a pair, twice as wide as tall.
  'effects/eyes': [1, 0.5],
  'buildings/shipyard': [5, 5],
  'buildings/ship_scaffold': [5, 5],
  'buildings/ship_pad': [5, 5],
  'buildings/ship_hull': [5, 5],
  'buildings/ship_engine': [5, 5],
  'buildings/ship_life': [5, 5],
  'buildings/ship_nav': [5, 5],
  'terrain/tree_round': [2, 2],
  'terrain/tree_autumn': [2, 2],
  'terrain/tree_pine': [2, 2],
  'terrain/bush': [2, 2],
  'terrain/tree_round_spring': [2, 2],
  'terrain/tree_round_fall': [2, 2],
  'terrain/tree_round_winter': [2, 2],
  'terrain/tree_round_late': [2, 2],
  'terrain/tree_pine_spring': [2, 2],
  'terrain/tree_pine_fall': [2, 2],
  'terrain/tree_pine_winter': [2, 2],
  'terrain/tree_pine_winter_snow': [2, 2],
  'effects/explosion': [2, 2],
  'effects/dust_burst': [2, 2],
};

/** A strip's frame count from its name ('…_4f'), or 0 for a single sprite. */
export function stripFrames(key: string): number {
  const m = /_(\d+)f$/.exec(key);
  return m ? Number(m[1]) : 0;
}

/** Tiles a sprite or one frame covers: a machine's working strip is the size of the machine. */
export function tilesOf(key: string): [number, number] {
  return TILES[key] ?? TILES[key.replace(/_working$/, '')] ?? [1, 1];
}

/** Each strip's frames, by its name without the count ('enemies/crawler_walk'). */
const strips = new Map<string, HTMLCanvasElement[]>();
const cache = new Map<string, HTMLCanvasElement>();

/** URL for use in HTML (toolbar, menus). */
export function artUrl(key: string): string | undefined {
  return urls.get(key);
}

/** How many sprites have loaded so far; pictures cached from sprites redraw when it changes. */
export function spritesLoaded(): number {
  return cache.size;
}

/** A pre-rendered sprite for the canvas, if it exists and has loaded. */
export function sprite(key: string): HTMLCanvasElement | undefined {
  return cache.get(key);
}

/** Frame `i` of a strip (counting round: any whole number works), if it exists and has loaded. */
export function frame(key: string, i: number): HTMLCanvasElement | undefined {
  const frames = strips.get(key);
  if (!frames) return undefined;
  const n = frames.length;
  return frames[((Math.floor(i) % n) + n) % n];
}

/**
 * Pixel art (D-186): sheets under `pixel/` are kept at their own size, never stretched or smoothed. A sheet is a
 * grid of square cells, one row per direction (facing east, then a turn clockwise each row) and one column per
 * frame; the cell size is the sheet's width over 4.
 */
const PIXEL_FRAMES = 4;
const pixelSheets = new Map<string, HTMLCanvasElement[][]>();

/** Cuts a pixel sheet into its directions and frames. */
function cutPixelSheet(img: HTMLImageElement): HTMLCanvasElement[][] {
  const size = Math.floor(img.naturalWidth / PIXEL_FRAMES);
  const rows: HTMLCanvasElement[][] = [];
  for (let d = 0; d * size < img.naturalHeight; d++) {
    const row: HTMLCanvasElement[] = [];
    for (let i = 0; i < PIXEL_FRAMES; i++) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d')!.drawImage(img, i * size, d * size, size, size, 0, 0, size, size);
      row.push(c);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * A pixel-art frame turned the nearest way to `angle` (radians, clockwise on screen from east), if the sheet has
 * loaded: frame `i` counts round, like frame().
 */
export function pixelFrame(key: string, angle: number, i: number): HTMLCanvasElement | undefined {
  const rows = pixelSheets.get(key);
  if (!rows?.length) return undefined;
  const n = rows.length;
  const d = ((Math.round((angle / (Math.PI * 2)) * n) % n) + n) % n;
  return rows[d][((Math.floor(i) % PIXEL_FRAMES) + PIXEL_FRAMES) % PIXEL_FRAMES];
}

/** How many frames a strip has (0 if it isn't loaded). */
export function frameCount(key: string): number {
  return strips.get(key)?.length ?? 0;
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
            if (key.startsWith('pixel/')) {
              pixelSheets.set(key, cutPixelSheet(img));
              resolve();
              return;
            }
            const unit = key.startsWith('items/') ? PX_PER_TILE / 2 : PX_PER_TILE;
            const n = stripFrames(key);
            const name = n ? key.replace(/_\d+f$/, '') : key;
            const [tw, th] = tilesOf(name);
            const w = unit * tw;
            const h = unit * th;
            const whole = document.createElement('canvas');
            whole.width = w * Math.max(1, n);
            whole.height = h;
            whole.getContext('2d')!.drawImage(img, 0, 0, whole.width, whole.height);
            if (n) {
              // Cut the strip into its frames.
              const frames: HTMLCanvasElement[] = [];
              for (let i = 0; i < n; i++) {
                const f = document.createElement('canvas');
                f.width = w;
                f.height = h;
                f.getContext('2d')!.drawImage(whole, i * w, 0, w, h, 0, 0, w, h);
                frames.push(f);
              }
              strips.set(name, frames);
            }
            cache.set(key, n ? strips.get(name)![0] : whole);
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
