// Realistic weapon and impact sounds (#214, round 2): the owner kept these as neither classic nor enhanced
// and asked for them to sound more real. Still synthesized, but built the way the real thing sounds:
// - a gunshot is a crack (a millisecond of bright noise), a body (darker noise dying fast), a low thump
//   and a tail (the shot echoing back), and the gun's action clicking after;
// - an explosion adds a sub-bass drop, a long rumble and crackle (bits landing at random);
// - struck metal rings with partials that aren't harmonics (1, 2.76, 5.40 and 8.93 times the note, as a
//   struck bar does), each dying at its own rate;
// - an electric arc is a burst of irregular snaps over a mains buzz;
// - each weapon has its own sound: the hydraulic turret, the Mk.2's bullets, the ballista, the trebuchet,
//   the cannon, the mortar, the artillery, the tesla and the railgun.

import { Layer, noise, Sound, tone } from './sfx';
import { pulse } from './sfx-enhanced';

/** A struck metal plate or bar: inharmonic partials, the higher ones dying sooner. */
export function ring(f: number, dur: number, peak: number, at = 0): Layer[] {
  return [
    [1, 1, 1],
    [2.76, 0.55, 0.6],
    [5.4, 0.3, 0.35],
    [8.93, 0.15, 0.2],
  ].map(([m, p, d]) => tone('sine', f * m, f * m * 0.995, dur * d, peak * p, at, 0.001));
}

/** Snaps or crackles: `n` very short noise bursts at random times over `span` seconds, fading. */
export function crackle(n: number, span: number, from: number, peak: number, at = 0, q = 2): Layer[] {
  return Array.from({ length: n }, (_, i) => {
    const t = at + Math.random() * span;
    const f = from * (0.7 + Math.random() * 0.6);
    const fade = 1 - (i / n) * 0.5;
    return noise('bandpass', f, f * 0.8, 0.008 + Math.random() * 0.018, peak * fade * (0.5 + Math.random() * 0.5), q, t, 0.001);
  });
}

/** A shot's crack, body, thump and tail, scaled by `size` (1 for a rifle-sized gun). */
export function gunshot(size: number, peak: number): Layer[] {
  return [
    noise('highpass', 5000, 2500, 0.025, peak * 0.9, 0.7, 0, 0.001),
    noise('lowpass', 3200 / size, 350 / size, 0.12 * size, peak, 0.9, 0, 0.001),
    tone('sine', 120 / size, 45 / size, 0.1 * size, peak, 0, 0.002),
    noise('lowpass', 1000 / size, 200 / size, 0.35 * size, peak * 0.22, 0.7, 0.03, 0.02),
  ];
}

/** An explosion's boom, `size` 1 for a cannon. */
export function boom(size: number, peak: number): Layer[] {
  return [
    noise('highpass', 3500, 1500, 0.03, peak * 0.5, 0.7, 0, 0.001),
    noise('lowpass', 2400, 140, 0.55 * size, peak, 0.8, 0, 0.003),
    tone('sine', 72 / size, 26, 0.6 * size, peak * 1.1, 0, 0.003),
    noise('lowpass', 500, 70, 1.1 * size, peak * 0.35, 0.7, 0.05, 0.08),
    ...crackle(Math.round(8 * size), 0.5 * size, 2200, peak * 0.25, 0.08),
  ];
}

/**
 * Each realistic sound's level, matched to its classic one (measured as for the enhanced ones), except the
 * artillery, left 3 dB louder: it's the biggest gun.
 */
export const REAL_LEVEL: Partial<Record<Sound, number>> = {
  shot: 0.38,
  gun: 0.2,
  hub_shot: 0.18,
  twang: 0.76,
  treb: 0.36,
  cannon: 0.8,
  mortar: 1.23,
  zap: 0.45,
  rail: 0.33,
  death: 0.69,
  destroyed: 0.83,
  hub_hit: 0.37,
  ignite: 0.3,
  launch: 0.32,
};

/** The realistic recipe for a sound, or null where there's none (the enhanced one plays instead). */
export function realisticRecipe(sound: Sound): Layer[] | null {
  switch (sound) {
    case 'shot':
      // The Hydraulic Turret (round 3, "Plate flung"): a spring-loaded snap, and the plate whirring off as it spins.
      return [
        noise('bandpass', 1800, 1400, 0.02, 0.4, 2, 0, 0.001),
        tone('triangle', 900, 700, 0.04, 0.2, 0, 0.001),
        ...Array.from({ length: 6 }, (_, i) => noise('bandpass', 1500 - i * 120, 1400 - i * 120, 0.025, 0.14 * (1 - i / 7), 4, 0.03 + i * 0.03, 0.003)),
        tone('sine', 160, 90, 0.05, 0.3, 0, 0.002),
      ];
    case 'gun':
      // Turret Mk.2: a real gunshot and the action cycling.
      return [...gunshot(1, 0.55), tone('triangle', 3100, 3000, 0.012, 0.06, 0.07), tone('triangle', 2300, 2250, 0.012, 0.05, 0.1)];
    case 'hub_shot':
      // The hub's gun: heavier than the Mk.2.
      return [...gunshot(1.4, 0.6), ...ring(900, 0.1, 0.05, 0.09)];
    case 'twang':
      // The ballista: the string's thwack, its hum dying away, and the bolt hissing off.
      return [
        noise('bandpass', 900, 700, 0.03, 0.5, 1.5, 0, 0.001),
        tone('triangle', 196, 188, 0.3, 0.28, 0, 0.002),
        tone('sine', 392, 378, 0.2, 0.08, 0, 0.002),
        noise('bandpass', 2600, 700, 0.28, 0.14, 2, 0.02, 0.04),
        noise('lowpass', 400, 120, 0.08, 0.3, 0.8, 0, 0.002),
      ];
    case 'treb':
      // The trebuchet: the frame creaks, the arm swings through with a rising whoosh, and slams its stop.
      return [
        noise('bandpass', 420, 300, 0.3, 0.12, 9, 0, 0.05),
        tone('sawtooth', 85, 70, 0.28, 0.05, 0, 0.05),
        noise('bandpass', 350, 1500, 0.45, 0.28, 1.2, 0.05, 0.35),
        tone('sine', 85, 35, 0.25, 0.6, 0.48, 0.002),
        noise('lowpass', 900, 100, 0.3, 0.4, 0.8, 0.48, 0.002),
        ...crackle(4, 0.15, 900, 0.1, 0.5),
      ];
    case 'cannon':
      // The Hydraulic Cannon: a boom.
      return boom(1, 0.6);
    case 'mortar':
      // A mortar's hollow "thoonk" as the shell leaves the tube, then a short tail.
      return [
        tone('sine', 190, 70, 0.14, 0.6, 0, 0.002),
        noise('bandpass', 450, 200, 0.16, 0.45, 2, 0, 0.002),
        noise('highpass', 3000, 2000, 0.02, 0.2, 0.7, 0, 0.001),
        noise('lowpass', 600, 120, 0.5, 0.15, 0.7, 0.05, 0.03),
      ];
    case 'artillery':
      // A big gun: a deep boom with a long rumble, and its echo coming back off the land.
      return [...boom(1.6, 0.65), noise('lowpass', 700, 90, 0.8, 0.14, 0.7, 0.42, 0.05), tone('sine', 50, 28, 0.6, 0.18, 0.42, 0.02)];
    case 'zap':
      // The tesla (round 3, "Lightning crack"): a lightning strike in small, a whip-crack and a short roll of thunder.
      return [
        noise('highpass', 7000, 3500, 0.015, 0.7, 0.7, 0, 0.001),
        ...crackle(6, 0.04, 5000, 0.45, 0, 1),
        noise('lowpass', 900, 90, 0.5, 0.25, 0.7, 0.03, 0.03),
        tone('sine', 70, 35, 0.4, 0.2, 0.03, 0.02),
      ];
    case 'rail':
      // The railgun: a supersonic crack, the rails ringing, a thump and the coils humming down.
      return [
        noise('highpass', 6000, 3000, 0.02, 0.6, 0.7, 0, 0.001),
        ...ring(1180, 0.5, 0.1, 0.005),
        tone('sine', 95, 38, 0.18, 0.55, 0, 0.002),
        tone('sawtooth', 240, 120, 0.4, 0.05, 0, 0.005),
        noise('highpass', 4500, 1500, 0.4, 0.08, 0.7, 0.02, 0.01),
      ];
    case 'death':
      // A bug dies: its shell cracks, then a wet squish.
      return [...crackle(5, 0.04, 3200, 0.35, 0, 3), noise('lowpass', 900, 180, 0.13, 0.4, 2.5, 0.02, 0.005), tone('sine', 220, 90, 0.08, 0.12, 0.02, 0.005)];
    case 'destroyed':
      // A building collapses: a crash, a thud, and debris clattering down for a while.
      return [noise('lowpass', 3200, 180, 0.55, 0.55, 0.8, 0, 0.002), tone('sine', 62, 24, 0.5, 0.65, 0, 0.003), ...ring(620, 0.25, 0.08, 0.03), ...crackle(12, 0.75, 1600, 0.2, 0.12, 2.5)];
    case 'hub_hit':
      // Bugs bite the hub or the engineer (round 3, "Warning hit"): a thud and a short, low warning beep.
      return [tone('sine', 110, 55, 0.14, 0.5, 0, 0.002), noise('lowpass', 1100, 200, 0.1, 0.3, 0.8, 0, 0.002), pulse(0.25, 330, 330, 0.1, 0.07, 0.08), pulse(0.25, 262, 262, 0.14, 0.07, 0.19)];
    case 'ignite':
      // Launch pressed: the engines light with a crack and a deep rumble that swells, then settles to wait.
      return [
        noise('highpass', 3000, 1500, 0.05, 0.4, 0.7, 0, 0.002),
        noise('lowpass', 100, 600, 2.5, 0.6, 0.7, 0.02, 0.3),
        tone('sine', 36, 48, 2.5, 0.4, 0.02, 0.3),
        ...crackle(10, 1.5, 900, 0.1, 0.1, 1),
      ];
    case 'launch':
      // Lift-off (round 3, "Big rocket", made longer): a deep roar you feel more than hear, building through the
      // ship's climb (SHIP.liftShow), then drifting away into the sky.
      return [
        noise('lowpass', 110, 1300, 9, 0.9, 0.7, 0, 6),
        tone('sine', 30, 50, 9, 0.5, 0, 5),
        ...crackle(70, 9.5, 900, 0.12, 0.6, 1),
        noise('lowpass', 1300, 150, 4.5, 0.6, 0.7, 8.6, 0.4),
        tone('sine', 50, 32, 4, 0.25, 8.6, 0.4),
      ];
    default:
      return null;
  }
}
