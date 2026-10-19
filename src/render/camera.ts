/** 2D camera: tracks the world point at the screen centre and pixels per tile. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 32;
  width = 0; // viewport size in CSS pixels
  height = 0;
  minZoom = 8;
  maxZoom = 96;

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
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    const [nx, ny] = this.toWorld(sx, sy);
    this.x += wx - nx;
    this.y += wy - ny;
  }

  clampTo(width: number, height: number): void {
    this.x = Math.min(width, Math.max(0, this.x));
    this.y = Math.min(height, Math.max(0, this.y));
  }
}
