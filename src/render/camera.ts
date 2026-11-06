/** 2D camera: tracks the world point at the screen centre and pixels per tile. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 32;
  width = 0; // viewport size in CSS pixels
  height = 0;
  minZoom = 8;
  maxZoom = 96;
  /**
   * The pixel art test (D-182): zoom moves in whole steps of this many CSS pixels per tile, so every art pixel
   * covers a whole number of screen pixels. 0: zoom is free.
   */
  private step = 0;
  /** The zoom gestures have asked for; `zoom` is it snapped to a step, so slow gestures still add up. */
  private wanted = 32;

  /** Sets the zoom step (0 for free zoom) and snaps the zoom to it. */
  setStep(step: number): void {
    if (step === this.step) return;
    if (!this.step) this.wanted = this.zoom; // from free zoom, start where it is; between steps, keep what was asked
    this.step = step;
    this.zoom = this.snap(this.wanted);
  }

  /** Sets the zoom, snapped to the step if there is one. */
  setZoom(zoom: number): void {
    this.wanted = Math.min(this.maxZoom, Math.max(this.minZoom, zoom));
    this.zoom = this.snap(this.wanted);
  }

  /** The nearest whole step to `zoom` that lies between the zoom limits. */
  snap(zoom: number): number {
    if (!this.step) return zoom;
    const lo = Math.ceil(this.minZoom / this.step - 1e-9);
    const hi = Math.max(lo, Math.floor(this.maxZoom / this.step + 1e-9));
    return Math.min(hi, Math.max(lo, Math.round(zoom / this.step))) * this.step;
  }

  toScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.zoom + this.width / 2, (wy - this.y) * this.zoom + this.height / 2];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.width / 2) / this.zoom + this.x, (sy - this.height / 2) / this.zoom + this.y];
  }

  /** Moves the view by a screen-space delta (e.g. a drag). */
  pan(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  /** Zooms while keeping the world point under (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const [wx, wy] = this.toWorld(sx, sy);
    this.setZoom((this.step ? this.wanted : this.zoom) * factor);
    const [nx, ny] = this.toWorld(sx, sy);
    this.x += wx - nx;
    this.y += wy - ny;
  }

  clampTo(width: number, height: number): void {
    this.x = Math.min(width, Math.max(0, this.x));
    this.y = Math.min(height, Math.max(0, this.y));
  }
}
