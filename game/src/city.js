// Solmar Heat — the city of Solmar.
// A procedural coastal city on a road grid: blocks of stucco and glass towers,
// a beach and pier along the south edge, a stadium, a marina plaza and parks.
// Generation is fully seeded, so the same seed always builds the same city,
// which is what makes the screenshots reproducible. Collision is circle
// against building rectangles, resolved by pushing the circle out.

import { WORLD, PALETTE, clamp, dist } from './config.js';
import { RNG } from './random.js';

export function roadLines() {
  const lines = [];
  for (let i = -WORLD.blocks; i <= WORLD.blocks; i += 1) lines.push(i * WORLD.pitch);
  return lines;
}

export function isOnRoad(x, z) {
  const lines = roadLines();
  for (let i = 0; i < lines.length; i += 1) {
    if (Math.abs(x - lines[i]) < WORLD.halfRoad + 1.5) return true;
    if (Math.abs(z - lines[i]) < WORLD.halfRoad + 1.5) return true;
  }
  return false;
}

export function nearestRoadPoint(x, z) {
  const lines = roadLines();
  let bestX = lines[0];
  let bestZ = lines[0];
  for (let i = 0; i < lines.length; i += 1) {
    if (Math.abs(lines[i] - x) < Math.abs(bestX - x)) bestX = lines[i];
    if (Math.abs(lines[i] - z) < Math.abs(bestZ - z)) bestZ = lines[i];
  }
  // Snap to whichever road line is closer.
  if (Math.abs(bestX - x) <= Math.abs(bestZ - z)) return { x: bestX, z };
  return { x, z: bestZ };
}

export function buildCity(seed) {
  const rng = new RNG(seed);
  const buildings = [];
  const parks = [];
  const palms = [];
  const lamps = [];
  const stashes = [];
  const landmarks = [];

  const lines = roadLines();
  const half = WORLD.halfRoad;

  // Street lamps along every road, both sides, every 30 metres.
  for (let i = 0; i < lines.length; i += 1) {
    for (let t = -WORLD.bound; t <= WORLD.bound; t += 30) {
      lamps.push({ x: lines[i] + half + 1.5, z: t, side: 1 });
      lamps.push({ x: t, z: lines[i] + half + 1.5, side: 0 });
    }
  }

  // One landmark per district so the skyline reads at a glance.
  landmarks.push({ kind: 'stadium', x: -150, z: -150, w: 52, d: 52, h: 16, label: 'Solmar Bowl' });
  landmarks.push({ kind: 'tower', x: 150, z: -150, w: 26, d: 26, h: 58, label: 'Harbor Tower' });
  landmarks.push({ kind: 'hotel', x: 30, z: 270, w: 44, d: 20, h: 34, label: 'Palma Hotel' });
  landmarks.push({ kind: 'pier', x: -90, z: 330, w: 60, d: 10, h: 3, label: 'Solmar Pier' });
  landmarks.push({ kind: 'marina', x: 210, z: 270, w: 40, d: 30, h: 6, label: 'Marina' });

  // Blocks: the cell between road i and road i+1, on both axes.
  for (let i = -WORLD.blocks; i < WORLD.blocks; i += 1) {
    for (let j = -WORLD.blocks; j < WORLD.blocks; j += 1) {
      const cx = i * WORLD.pitch + WORLD.pitch / 2;
      const cz = j * WORLD.pitch + WORLD.pitch / 2;
      // The beach strip stays open: no blocks south of the beach line.
      if (cz > WORLD.beachAt - 30) continue;
      // Keep the landmark plots clear of random buildings.
      let claimed = false;
      for (let l = 0; l < landmarks.length; l += 1) {
        if (Math.abs(landmarks[l].x - cx) < 40 && Math.abs(landmarks[l].z - cz) < 40) claimed = true;
      }
      if (claimed) continue;
      const roll = rng.next();
      if (roll < 0.12) {
        parks.push({ x: cx, z: cz, w: 44, d: 44 });
        for (let p = 0; p < 5; p += 1) {
          palms.push({ x: cx + rng.range(-18, 18), z: cz + rng.range(-18, 18) });
        }
        continue;
      }
      if (roll < 0.18) {
        // Open plaza with a fountain court: flat, walkable, no buildings.
        parks.push({ x: cx, z: cz, w: 44, d: 44, plaza: true });
        continue;
      }
      // A normal block holds one tall slab or up to four smaller buildings.
      const downtown = Math.abs(cx) < 130 && Math.abs(cz) < 130;
      const count = downtown && rng.chance(0.45) ? 1 : rng.int(2, 4);
      for (let b = 0; b < count; b += 1) {
        const w = count === 1 ? rng.range(26, 38) : rng.range(12, 20);
        const d = count === 1 ? rng.range(26, 38) : rng.range(12, 20);
        const ox = count === 1 ? 0 : rng.range(-11, 11);
        const oz = count === 1 ? 0 : rng.range(-11, 11);
        const h = downtown
          ? rng.range(18, 52)
          : rng.range(7, 26);
        buildings.push({
          x: cx + ox,
          z: cz + oz,
          w,
          d,
          h,
          color: rng.pick(PALETTE.building),
          roof: rng.pick(PALETTE.roof),
          glass: rng.chance(0.35),
        });
      }
    }
  }

  // Palm-lined beach and a dozen hidden cash stashes to hunt.
  for (let x = -300; x <= 300; x += 24) {
    palms.push({ x: x + rng.range(-6, 6), z: WORLD.beachAt + rng.range(2, 14) });
  }
  for (let s = 0; s < 12; s += 1) {
    const spot = randomStreetPoint(rng);
    stashes.push({ x: spot.x + rng.range(-4, 4), z: spot.z + rng.range(-4, 4), taken: false, id: s });
  }

  const city = {
    seed,
    buildings,
    parks,
    palms,
    lamps,
    landmarks,
    stashes,
    lines,
    bound: WORLD.bound,
  };
  return city;
}

// A random point on a road, for spawns, passengers and mission targets.
export function randomStreetPoint(rng) {
  const lines = roadLines();
  const line = rng.pick(lines);
  const along = rng.range(-WORLD.bound + 20, WORLD.bound - 20);
  if (rng.chance(0.5)) return { x: line, z: along };
  return { x: along, z: line };
}

// A random point inside a block (off the road), for parked cars and stashes.
export function randomBlockPoint(rng) {
  const i = rng.int(-WORLD.blocks, WORLD.blocks - 1);
  const j = rng.int(-WORLD.blocks, WORLD.blocks - 1);
  return {
    x: i * WORLD.pitch + WORLD.pitch / 2 + rng.range(-16, 16),
    z: j * WORLD.pitch + WORLD.pitch / 2 + rng.range(-16, 16),
  };
}

function collideWithRects(x, z, r, rects) {
  let nx = x;
  let nz = z;
  for (let i = 0; i < rects.length; i += 1) {
    const b = rects[i];
    const hw = b.w / 2 + r;
    const hd = b.d / 2 + r;
    const dx = nx - b.x;
    const dz = nz - b.z;
    if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
      const px = hw - Math.abs(dx);
      const pz = hd - Math.abs(dz);
      if (px < pz) nx = b.x + (dx > 0 ? hw : -hw);
      else nz = b.z + (dz > 0 ? hd : -hd);
    }
  }
  return { x: nx, z: nz };
}

// Push a circle out of every solid rectangle (buildings and landmarks).
// Returns the corrected position; the caller keeps its own velocity logic.
export function collideCircle(city, x, z, r) {
  const rects = city.buildings.concat(city.landmarks);
  let p = collideWithRects(x, z, r, rects);
  p.x = clamp(p.x, -city.bound, city.bound);
  p.z = clamp(p.z, -city.bound, city.bound);
  return p;
}

export function pointInBuilding(city, x, z, pad) {
  const rects = city.buildings.concat(city.landmarks);
  for (let i = 0; i < rects.length; i += 1) {
    const b = rects[i];
    if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return b;
  }
  return null;
}

export function distanceToSea(z) {
  return WORLD.seaAt - z;
}

export function cityStats(city) {
  return {
    buildings: city.buildings.length,
    parks: city.parks.length,
    palms: city.palms.length,
    lamps: city.lamps.length,
    landmarks: city.landmarks.length,
    stashes: city.stashes.length,
  };
}
