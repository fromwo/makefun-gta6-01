// Solmar Heat — city.js (r9)
// Procedural layout of Solmar: a road grid, blocks of buildings, a
// beach and sea along the west edge, a central park, and the harbor
// in the south-east. Everything is derived from the seed, so the
// same seed always yields the same streets and skyline.
import { CONFIG, DISTRICTS } from './config.js';
import { makeRng } from './random.js';

export function buildCity(seed) {
  const rng = makeRng(seed);
  const size = CONFIG.worldSize;
  const step = CONFIG.blockSize + CONFIG.roadWidth;
  const roads = [];
  for (let x = CONFIG.roadWidth; x < size; x += step) {
    roads.push({ x, y: 0, w: CONFIG.roadWidth, h: size, vertical: true });
  }
  for (let y = CONFIG.roadWidth; y < size; y += step) {
    roads.push({ x: 0, y, w: size, h: CONFIG.roadWidth, vertical: false });
  }
  const palette = [CONFIG.colors.building, CONFIG.colors.building2, CONFIG.colors.building3, '#8a6fb5', '#5e9b8a'];
  const buildings = [];
  for (let bx = 0; bx < 9; bx++) {
    for (let by = 0; by < 9; by++) {
      const x0 = CONFIG.roadWidth * 2 + bx * step;
      const y0 = CONFIG.roadWidth * 2 + by * step;
      if (x0 > size - 300 || y0 > size - 300) continue;
      if (bx === 4 && by === 4) continue; // the central park block stays open
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const w = rng.int(70, 130);
        const h = rng.int(70, 130);
        const x = x0 + rng.int(0, Math.max(1, CONFIG.blockSize - w - 10));
        const y = y0 + rng.int(0, Math.max(1, CONFIG.blockSize - h - 10));
        buildings.push({
          x, y, w, h,
          color: rng.pick(palette),
          hgt: rng.int(18, 60),
          name: 'Block ' + (bx + 1) + '-' + (by + 1),
        });
      }
    }
  }
  const beach = { x: 0, y: 0, w: 150, h: size };
  const sea = { x: -400, y: 0, w: 400, h: size };
  const park = {
    x: CONFIG.roadWidth * 2 + 4 * step,
    y: CONFIG.roadWidth * 2 + 4 * step,
    w: CONFIG.blockSize,
    h: CONFIG.blockSize,
  };
  const harbor = { x: size - 700, y: size - 500, w: 700, h: 500 };
  return { seed, size, roads, buildings, beach, sea, park, harbor, districts: DISTRICTS };
}

export function pointOnRoad(city, x, y) {
  for (const r of city.roads) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function collidesBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
  }
  return null;
}

export function clampToWorld(x, y, margin) {
  const m = margin || 20;
  return {
    x: Math.max(m, Math.min(CONFIG.worldSize - m, x)),
    y: Math.max(m, Math.min(CONFIG.worldSize - m, y)),
  };
}

export function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d.name;
  }
  return 'Solmar';
}

// r9: a point is "in the park" when it falls inside the open central block.
export function pointInPark(city, x, y) {
  return pointInRect(x, y, city.park);
}

export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const r of city.roads) {
    const cx = Math.max(r.x, Math.min(x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(y, r.y + r.h));
    const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
    if (d < bestD) {
      bestD = d;
      best = { x: cx, y: cy, vertical: r.vertical };
    }
  }
  return best;
}
