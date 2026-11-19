// Solmar Heat — the city of Solmar, built from a seed.
// A regular road grid (roads every 400 px), blocks filled with buildings,
// a park, a plaza, a marina edge and a beach with the sea along the south.
// Traffic drives the intersections; the player collides with the buildings.

import { WORLD, DISTRICTS, PALETTE } from './config.js';
import { Rng } from './random.js';

const AVENUES = ['Palm Ave', 'Coral St', 'Sunset Blvd', 'Marina Way', 'Harbor Rd', 'Citrus Ln', 'Wave St'];
const ROOFS = [PALETTE.buildingRoof, PALETTE.buildingRoof2, PALETTE.buildingRoof3, '#9a7a8a', '#6a8a7a'];

export function buildCity(seed) {
  const rng = new Rng(seed);
  const { width, height, roadEvery, roadWidth } = WORLD;
  const half = roadWidth / 2;

  // Road centre lines: first at roadEvery/2 from the edge, then every roadEvery.
  const verticals = [];
  const horizontals = [];
  for (let x = roadEvery / 2; x < width; x += roadEvery) verticals.push(x);
  for (let y = roadEvery / 2; y < height; y += roadEvery) horizontals.push(y);

  const intersections = [];
  for (const x of verticals) {
    for (const y of horizontals) intersections.push({ x, y });
  }

  const buildings = [];
  const parks = [];
  const plazas = [];
  let id = 0;
  for (let bx = 0; bx < verticals.length - 1; bx += 1) {
    for (let by = 0; by < horizontals.length - 1; by += 1) {
      const x0 = verticals[bx] + half + WORLD.sidewalk;
      const x1 = verticals[bx + 1] - half - WORLD.sidewalk;
      const y0 = horizontals[by] + half + WORLD.sidewalk;
      const y1 = horizontals[by + 1] - half - WORLD.sidewalk;
      // The south row of blocks is the beach: sand, palms, no buildings.
      if (y0 >= WORLD.beachTop - 200) continue;
      const roll = rng.next();
      if (roll < 0.1) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: rng.int(5, 9) });
        continue;
      }
      if (roll < 0.16) {
        plazas.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // One to four buildings per block, each with a height for the fake 3D roof.
      const count = rng.int(1, 3);
      const tall = by === 0 || (bx <= 1 && by <= 1);
      for (let k = 0; k < count; k += 1) {
        const w = rng.range(70, Math.min(150, (x1 - x0) / count - 14));
        const h = rng.range(70, Math.min(150, y1 - y0 - 14));
        const x = x0 + ((x1 - x0 - w) * (count === 1 ? 0.5 : rng.next()));
        const y = y0 + ((y1 - y0 - h) * (count === 1 ? 0.5 : rng.next()));
        buildings.push({
          id: id += 1,
          x, y, w, h,
          height: tall ? rng.range(26, 54) : rng.range(8, 26),
          roof: rng.pick(ROOFS),
          district: districtAtPoint(x + w / 2, y + h / 2).name,
        });
      }
    }
  }

  // Palm trees along the beach promenade.
  const palms = [];
  for (let x = 120; x < width - 100; x += rng.range(90, 170)) {
    palms.push({ x, y: WORLD.beachTop + rng.range(30, 90) });
  }

  return {
    seed,
    width,
    height,
    verticals,
    horizontals,
    intersections,
    buildings,
    parks,
    plazas,
    palms,
    roadWidth,
    half,
  };
}

export function districtAtPoint(x, y) {
  for (const district of DISTRICTS) {
    if (x >= district.x0 && x < district.x1 && y >= district.y0 && y < district.y1) return district;
  }
  return DISTRICTS[DISTRICTS.length - 1];
}

export function streetNameAt(x, y, city) {
  const vx = nearestLine(city.verticals, x);
  const hy = nearestLine(city.horizontals, y);
  const avenue = AVENUES[Math.abs(Math.round(vx / WORLD.roadEvery)) % AVENUES.length];
  const street = AVENUES[Math.abs(Math.round(hy / WORLD.roadEvery)) % AVENUES.length];
  return `${avenue} & ${street}`;
}

function nearestLine(lines, value) {
  let best = lines[0];
  for (const line of lines) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

export function isOnRoad(city, x, y) {
  if (y >= WORLD.beachTop) return false;
  for (const vx of city.verticals) {
    if (Math.abs(x - vx) <= city.half) return true;
  }
  for (const hy of city.horizontals) {
    if (Math.abs(y - hy) <= city.half) return true;
  }
  return false;
}

/** Push a circle out of every building it overlaps; returns true on a hit. */
export function resolveCircle(city, body, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nearestX = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const nearestY = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - nearestX;
    const dy = body.y - nearestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= radius * radius) continue;
    hit = true;
    if (distSq < 0.0001) {
      body.y = b.y - radius;
      continue;
    }
    const dist = Math.sqrt(distSq);
    const push = (radius - dist) / dist;
    body.x += dx * push;
    body.y += dy * push;
  }
  return hit;
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function nearestIntersection(city, x, y) {
  let best = city.intersections[0];
  let bestDist = Infinity;
  for (const node of city.intersections) {
    const d = (node.x - x) ** 2 + (node.y - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = node;
    }
  }
  return best;
}

/** A random point on a road, away from the beach strip. */
export function randomStreetPoint(rng, city) {
  const vertical = rng.chance(0.5);
  if (vertical) {
    const x = rng.pick(city.verticals);
    const y = rng.range(120, WORLD.beachTop - 120);
    return { x: x + rng.range(-28, 28), y };
  }
  const y = rng.pick(city.horizontals);
  const x = rng.range(120, city.width - 120);
  return { x, y: y + rng.range(-28, 28) };
}
