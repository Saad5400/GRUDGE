/** Small math helpers shared by sim and render. No Three.js here — sim stays headless. */

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Frame-rate independent exponential decay factor: v *= expDecay(rate, dt). */
export function expDecay(rate: number, dt: number): number {
  return Math.exp(-rate * dt);
}

/** Shortest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function len2(x: number, z: number): number {
  return Math.hypot(x, z);
}

export function dist2(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(bx - ax, bz - az);
}
