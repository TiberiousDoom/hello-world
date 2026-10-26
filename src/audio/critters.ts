// Critters (D-101): birds in the morning and at midday, crickets and katydids in the evening, cicadas
// at dusk and frogs at night, fading through fall to almost none in winter. Heard all over the map, from
// no place in particular, so they live apart from the sounds of things happening (sounds.ts).

import { clockAt } from '../sim/clock';
import { Season } from '../sim/data';
import { Sfx } from './sfx';

export type Critter = 'bird' | 'cricket' | 'katydid' | 'cicada' | 'frog';

/** Calls a second from each critter when it's loudest. */
const RATE: Record<Critter, number> = { bird: 0.7, cricket: 1.2, katydid: 0.35, cicada: 0.15, frog: 0.5 };
/** How loud the calls are (the music and machines go over them). */
const GAIN = 0.5;

/** How much of each critter is about, 0 to 1, at a game time. */
export function chorus(time: number): Record<Critter, number> {
  const c = clockAt(time);
  const p = c.part;
  // By time of day, as a fraction of the day or of the night.
  const day = !c.night;
  const bird = day ? (p < 0.35 ? 1 : p < 0.65 ? 0.6 : p < 0.85 ? 0.3 : 0.05) : p > 0.9 ? 0.3 : 0;
  const evening = day ? Math.max(0, (p - 0.7) / 0.3) : p < 0.5 ? 1 : 0.4;
  const cicada = day ? Math.max(0, 1 - Math.abs(p - 0.9) / 0.12) : 0;
  const frog = day ? Math.max(0, (p - 0.88) / 0.12) * 0.4 : p < 0.9 ? 1 : 0.4;
  // By season: full in summer, waking in spring, fading through fall, nearly gone in winter.
  const fall = 1 - ((c.seasonDay - 1) / c.season.days) * 0.9;
  const insects = seasonal(c.season.id, { spring: 0.6, summer: 1, fall: fall * 0.8, winter: 0 });
  return {
    bird: bird * seasonal(c.season.id, { spring: 1, summer: 0.9, fall: fall, winter: 0.12 }),
    cricket: evening * insects,
    katydid: evening * insects * (c.season.id === 'spring' ? 0.3 : 1),
    cicada: cicada * seasonal(c.season.id, { spring: 0, summer: 1, fall: fall * 0.5, winter: 0 }),
    frog: frog * seasonal(c.season.id, { spring: 1, summer: 0.8, fall: fall * 0.5, winter: 0 }),
  };
}

function seasonal(id: Season['id'], by: Record<Season['id'], number>): number {
  return by[id];
}

export class Critters {
  private last = 0;

  constructor(private sfx: Sfx) {}

  /** Call every frame; `running` is false while paused, which hushes them. */
  update(time: number, running: boolean, now = performance.now()): void {
    const dt = Math.min(0.25, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!running || dt <= 0) return;
    const about = chorus(time);
    for (const k of Object.keys(RATE) as Critter[]) {
      if (Math.random() < about[k] * RATE[k] * dt) this.sfx.play(k, { gain: GAIN * (0.4 + Math.random() * 0.6), pan: (Math.random() * 2 - 1) * 0.8 });
    }
  }
}
