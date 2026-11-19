// Solmar Heat — a tiny seeded random source.
// Every system that needs chance takes one of these, so a fixed seed replays
// the same city, the same traffic and the same screenshot staging.

export function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.nextFloat = mulberry32(seed);
  }

  next() {
    return this.nextFloat();
  }

  range(low, high) {
    return low + (high - low) * this.nextFloat();
  }

  int(low, high) {
    return low + Math.floor(this.nextFloat() * (high - low + 1));
  }

  pick(list) {
    return list[Math.floor(this.nextFloat() * list.length)];
  }

  chance(probability) {
    return this.nextFloat() < probability;
  }

  sign() {
    return this.nextFloat() < 0.5 ? -1 : 1;
  }

  shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.nextFloat() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }
}
