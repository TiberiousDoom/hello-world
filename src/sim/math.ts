/**
 * Length of (x, y). Used instead of Math.hypot, whose last bit can differ between
 * browsers: games in co-op must compute exactly the same numbers (D-058).
 * Math.sqrt is exact everywhere.
 */
export function hypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}
