/**
 * Seeded deterministic RNG (mulberry32).
 * ALL gameplay randomness must flow through an Rng instance — never Math.random().
 * Same seed → same simulation, which is what makes headless sim tests and replays possible.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Random element of a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    const v = arr[Math.floor(this.next() * arr.length)];
    if (v === undefined && arr.length === 0) throw new Error('Rng.pick on empty array');
    return v as T;
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Derive an independent child stream (e.g. one per subsystem). */
  fork(): Rng {
    return new Rng(Math.floor(this.next() * 0xffffffff) ^ 0x85ebca6b);
  }
}
