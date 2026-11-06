import { describe, expect, it } from 'vitest';
import { Camera } from './camera';

describe('Zoom in whole steps for the pixel art test (D-186)', () => {
  it('is free without a step', () => {
    const c = new Camera();
    c.zoomAt(0, 0, 1.1);
    expect(c.zoom).toBeCloseTo(35.2);
  });

  it('snaps to whole steps, and slow gestures still add up to the next one', () => {
    const c = new Camera();
    c.width = 800;
    c.height = 600;
    c.setStep(16);
    expect(c.zoom).toBe(32);
    for (let i = 0; i < 3; i++) c.zoomAt(400, 300, 1.1);
    expect(c.zoom).toBe(48); // 32 × 1.1³ ≈ 42.6, nearer 48 than 32
    c.zoomAt(400, 300, 0.5);
    expect(c.zoom).toBe(16);
  });

  it('stays between the zoom limits, in whole steps', () => {
    const c = new Camera();
    c.setStep(16);
    c.setZoom(1000);
    expect(c.zoom).toBe(96);
    c.setZoom(1);
    expect(c.zoom).toBe(16); // 8 is the limit, but the smallest whole step above it is 16
    c.setStep(16 / 1.5); // a screen at 1.5× density: 10.67 CSS pixels a step, 16 screen pixels
    c.setZoom(32);
    expect(c.zoom * 1.5).toBeCloseTo(48);
  });

  it('keeps the point under the pointer still while it zooms', () => {
    const c = new Camera();
    c.width = 800;
    c.height = 600;
    c.x = 10;
    c.y = 10;
    c.setStep(16);
    const before = c.toWorld(600, 200);
    c.zoomAt(600, 200, 2);
    const after = c.toWorld(600, 200);
    expect(after[0]).toBeCloseTo(before[0]);
    expect(after[1]).toBeCloseTo(before[1]);
  });

  it('goes back to free zoom where it was', () => {
    const c = new Camera();
    c.setZoom(40);
    c.setStep(16);
    expect(c.zoom).toBe(48);
    c.setStep(0);
    expect(c.zoom).toBe(40);
  });
});
