// Costa Solmar's city: road grid, building blocks, parks, beach and landmarks.
// Buildings are generated inside blocks only — inset from every road — so no
// building ever sits on a road or covers an intersection, and every parked car
// gets a waypoint on a road, never a bare coordinate that throws.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, LANDMARKS, PALETTE } from './config.js';

function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function createCity(rng) {
  const buildings = [];
  const parks = [];
  // Blocks between neighbouring road centrelines.
  const xs = [0, ...ROADS_X, WORLD.width];
  const ys = [0, ...ROADS_Y, WORLD.height];
  const paletteKeys = ['buildingA', 'buildingB', 'buildingC', 'buildingD'];
  const roofKeys = ['roofA', 'roofB', 'roofC', 'roofD'];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + (bi === 0 ? 20 : ROAD_W / 2 + 18);
      const x1 = xs[bi + 1] - (bi === xs.length - 2 ? 20 : ROAD_W / 2 + 18);
      const y0 = ys[bj] + (bj === 0 ? 20 : ROAD_W / 2 + 18);
      const y1 = ys[bj + 1] - (bj === ys.length - 2 ? 20 : ROAD_W / 2 + 18);
      if (x1 - x0 < 90 || y1 - y0 < 70) continue;
      // The beach strip along the south edge stays open sand.
      if (y0 > 2220) continue;
      if (rng.next() < 0.16) { parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }); continue; }
      const cols = (x1 - x0) > 260 ? 2 : 1;
      const rows = (y1 - y0) > 220 ? 2 : 1;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const bw = (x1 - x0) / cols - 26;
          const bh = (y1 - y0) / rows - 26;
          const bx = x0 + 13 + c * ((x1 - x0) / cols);
          const by = y0 + 13 + r * ((y1 - y0) / rows);
          const k = rng.int(0, 3);
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            color: PALETTE[paletteKeys[k]], roof: PALETTE[roofKeys[k]],
            tall: rng.next() < 0.22,
          });
        }
      }
    }
  }
  // Landmarks replace any generated building they overlap.
  for (const lm of LANDMARKS) {
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      const b = buildings[i];
      if (b.x < lm.x + lm.w && b.x + b.w > lm.x && b.y < lm.y + lm.h && b.y + b.h > lm.y) buildings.splice(i, 1);
    }
  }
  // Parked cars: each one sits beside a road with a road waypoint to drive to.
  const parked = [];
  const spots = [
    { x: 720, y: 300, angle: 0 }, { x: 1200, y: 700, angle: Math.PI / 2 }, { x: 1680, y: 1150, angle: 0 },
    { x: 240, y: 1560, angle: Math.PI / 2 }, { x: 2160, y: 640, angle: 0 }, { x: 2640, y: 1900, angle: Math.PI / 2 },
    { x: 1200, y: 1980, angle: 0 }, { x: 720, y: 1060, angle: Math.PI / 2 }, { x: 2960, y: 1100, angle: 0 },
    { x: 1680, y: 220, angle: Math.PI / 2 }, { x: 2640, y: 1060, angle: 0 }, { x: 480, y: 640, angle: Math.PI / 2 },
  ];
  for (const s of spots) {
    const wx = Math.abs(s.angle) < 0.1 ? s.x : s.x + 70;
    const wy = Math.abs(s.angle) < 0.1 ? s.y + 70 : s.y;
    parked.push({ x: s.x, y: s.y, angle: s.angle, waypoint: { x: wx, y: wy }, color: PALETTE.traffic[rng.int(0, PALETTE.traffic.length - 1)] });
  }
  return { buildings, parks, parked, onRoad };
}

// Circle vs building rects: push the circle out. Returns true when it hit.
export function collideBuildings(city, x, y, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) { hit = true; }
  }
  for (const lm of LANDMARKS) {
    if (lm.kind === 'plaza' || lm.kind === 'park') continue;
    const cx = Math.max(lm.x, Math.min(x, lm.x + lm.w));
    const cy = Math.max(lm.y, Math.min(y, lm.y + lm.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) hit = true;
  }
  return hit;
}

export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const rx of ROADS_X) for (const ry of ROADS_Y) {
    const d = (x - rx) * (x - rx) + (y - ry) * (y - ry);
    if (d < bestD) { bestD = d; best = { x: rx, y: ry }; }
  }
  return best;
}
