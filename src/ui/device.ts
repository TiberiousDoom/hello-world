// Words for the device in hand (#155, D-145): "tap" on a touch screen, "click" with a mouse.

/** Whether the main pointer is a finger. */
export function touchScreen(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** The touch wording on a touch screen, the mouse wording otherwise. */
export function byDevice(touch: string, mouse: string): string {
  return touchScreen() ? touch : mouse;
}
