// Solmar Heat — the city of Solmar: roads, blocks, buildings, beach, parks.
// All geometry is generated once from a fixed seed, so the map never changes.
import { WORLD, PALETTE, LANDMARKS } from "./config.js";
import { Rng, clamp } from "./random.js";

export function roadLines() {
  const lines = [];
  for (let p = WORLD.firstRoad; p < WORLD.size; p += WORLD.roadGap) lines.push(p);
  return lines;
}

export function isRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const p of roadLines()) {
    if (Math.abs(x - p) < half || Math.abs(y - p) < half) return true;
  }
  return false;
}

export function buildCity(seed = 20261121) {
  const rng = new Rng(seed);
  const lines = roadLines();
  const buildings = [];
  const parks = [];
  const plazas = [];
  const half = WORLD.roadWidth / 2;
  const margin = 26;
  // Landmark towers sit in block interiors, never on a road: snap each
  // landmark to the nearest block centre so the streets stay drivable.
  const landmarkRects = LANDMARKS.map((mark) => {
    const cx = Math.max(400, Math.min(2800, 400 + 400 * Math.round((mark.x - 400) / 400)));
    const cy = Math.max(400, Math.min(2800, 400 + 400 * Math.round((mark.y - 400) / 400)));
    return { x: cx - 70, y: cy - 55, w: 140, h: 110, name: mark.name };
  });
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + half + margin;
      const y0 = lines[j] + half + margin;
      const x1 = lines[i + 1] - half - margin;
      const y1 = lines[j + 1] - half - margin;
      if (y0 > WORLD.beachY - 60) continue;
      const roll = rng.next();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      if (roll < 0.2) {
        plazas.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const cols = rng.int(1, 2);
      const rows = rng.int(1, 2);
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng.chance(0.12)) continue;
          const w = cw * rng.range(0.55, 0.85);
          const h = ch * rng.range(0.55, 0.85);
          const x = x0 + c * cw + (cw - w) / 2 + rng.range(-8, 8);
          const y = y0 + r * ch + (ch - h) / 2 + rng.range(-8, 8);
          if (landmarkRects.some((l) => x < l.x + l.w + 20 && x + w + 20 > l.x && y < l.y + l.h + 20 && y + h + 20 > l.y)) continue;
          buildings.push({
            x, y, w, h,
            color: rng.pick(PALETTE.buildingRoof),
            tall: rng.chance(0.22),
            name: null,
          });
        }
      }
    }
  }
  // Named landmark towers sit on their blocks.
  for (const rect of landmarkRects) {
    buildings.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, color: "#5d7fa3", tall: true, name: rect.name });
  }
  return { lines, buildings, parks, plazas, landmarks: LANDMARKS };
}

export function collideCircleWithBuildings(city, x, y, radius) {
  let nx = x;
  let ny = y;
  for (const b of city.buildings) {
    const cx = clamp(nx, b.x, b.x + b.w);
    const cy = clamp(ny, b.y, b.y + b.h);
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * radius;
        ny = cy + (dy / d) * radius;
      } else {
        ny = b.y - radius;
      }
    }
  }
  return { x: clamp(nx, 20, WORLD.size - 20), y: clamp(ny, 20, WORLD.size - 20) };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function randomRoadPoint(rng) {
  const lines = roadLines();
  const horizontal = rng.chance(0.5);
  const line = rng.pick(lines);
  const along = rng.range(120, WORLD.size - 120);
  return horizontal ? { x: along, y: line } : { x: line, y: along };
}

export function randomSidewalkPoint(rng) {
  const lines = roadLines();
  const line = rng.pick(lines);
  const along = rng.range(120, WORLD.size - 120);
  const off = WORLD.roadWidth / 2 + 14;
  const side = rng.chance(0.5) ? off : -off;
  return rng.chance(0.5)
    ? { x: along, y: line + side }
    : { x: line + side, y: along };
}

export function nearestRoadLine(value) {
  let best = roadLines()[0];
  let bestD = Infinity;
  for (const p of roadLines()) {
    const d = Math.abs(value - p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
