// Deterministic, dependency-free value noise for procedural terrain.
// Produces stable results for a given seed so the board renders identically
// on every mount (no hydration or frame-to-frame drift).

function hash2(x: number, y: number, seed: number): number {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h ^ Math.imul(x | 0, 0x85ebca6b), 0xc2b2ae35);
  h = Math.imul(h ^ Math.imul(y | 0, 0x27d4eb2f), 0x165667b1);
  h ^= h >>> 15;
  return (h >>> 0) / 0xffffffff; // 0 .. 1
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// Smoothed value noise sampled at (x, y).
export function valueNoise(x: number, y: number, seed = 1337): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const v00 = hash2(xi, yi, seed);
  const v10 = hash2(xi + 1, yi, seed);
  const v01 = hash2(xi, yi + 1, seed);
  const v11 = hash2(xi + 1, yi + 1, seed);

  const u = smooth(xf);
  const v = smooth(yf);

  const a = v00 + (v10 - v00) * u;
  const b = v01 + (v11 - v01) * u;
  return a + (b - a) * v;
}

// Layered noise (fractal Brownian motion) for richer terrain relief.
export function fbm(x: number, y: number, seed = 1337, octaves = 3): number {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let max = 0;
  for (let o = 0; o < octaves; o++) {
    total += valueNoise(x * frequency, y * frequency, seed + o * 131) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / max;
}
