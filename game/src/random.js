// A small seeded random number generator (mulberry32): the same seed gives
// the same city, the same traffic and the same screenshot scene, which is
// what makes ?shot= repeatable and ?selftest=1 deterministic.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max] inclusive. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of an array, uniformly. */
export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

/** True with probability p (0..1). */
export function chance(rng, p) {
  return rng() < p;
}

/** A shuffled copy of an array. */
export function shuffle(rng, array) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Clamp a value into [min, max]. */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
