// Costa Solmar itself: roads, blocks, buildings, parks, the beach and the
// pier, all generated from the seeded random so the same seed builds the
// same city. Everything here is pure geometry — no drawing — so the rules,
// the renderer and the screenshots all share one city.

import { DISTRICTS, ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { chance, int, pick, range } from './random.js';

const BUILDING_COLORS = ['#8a7f72', '#9a8a76', '#7d8aa0', '#a08a6a', '#6f7d6a', '#96705a'];
const ROOF_COLORS = ['#6b5f55', '#5d5348', '#55627a', '#7a6248', '#57624f', '#6e4f3a'];
const TREE_SPOTS = 90;

// The big lawn in Palm Park: no buildings inside it, only trees.
const PARK_RECT = { x: 700, y: 1500, w: 700, h: 600 };
// The ocean strip along the west edge, and the sand beside it.
const WATER_EDGE = 90;
const SAND_EDGE = 210;

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function buildBuildings(rng) {
  const buildings = [];
  for (let xi = 0; xi < ROADS_X.length - 1; xi += 1) {
    for (let yi = 0; yi < ROADS_Y.length - 1; yi += 1) {
      const x0 = ROADS_X[xi] + ROAD_WIDTH / 2 + 14;
      const x1 = ROADS_X[xi + 1] - ROAD_WIDTH / 2 - 14;
      const y0 = ROADS_Y[yi] + ROAD_WIDTH / 2 + 14;
      const y1 = ROADS_Y[yi + 1] - ROAD_WIDTH / 2 - 14;
      if (x1 <= x0 + 60 || y1 <= y0 + 60) continue;
      // The beach strip and the park lawn stay open.
      if (x0 < SAND_EDGE + 40) continue;
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      if (rectsOverlap(block, PARK_RECT)) continue;
      const downtown = x0 > 1600 && y0 < 1200;
      const count = downtown ? int(rng, 2, 4) : int(rng, 1, 3);
      for (let n = 0; n < count; n += 1) {
        const bw = range(rng, 70, Math.min(170, block.w - 20));
        const bh = range(rng, 60, Math.min(150, block.h - 20));
        const bx = range(rng, block.x, block.x + block.w - bw);
        const by = range(rng, block.y, block.y + block.h - bh);
        const tall = downtown && chance(rng, 0.55);
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: downtown ? pick(rng, ['#7d8aa0', '#8fa0b8', '#6b7d94']) : pick(rng, BUILDING_COLORS),
          roof: downtown ? pick(rng, ['#55627a', '#46536a', '#3e4a5e']) : pick(rng, ROOF_COLORS),
          tall,
          floors: tall ? int(rng, 4, 9) : int(rng, 1, 3),
        });
      }
    }
  }
  return buildings;
}

function buildTrees(rng, buildings) {
  const trees = [];
  let guard = 0;
  while (trees.length < TREE_SPOTS && guard < 600) {
    guard += 1;
    const x = range(rng, 240, WORLD.width - 60);
    const y = range(rng, 240, WORLD.height - 60);
    if (isWaterPoint(x, y)) continue;
    if (onRoadPoint(x, y)) continue;
    if (buildings.some((b) => x > b.x - 16 && x < b.x + b.w + 16 && y > b.y - 16 && y < b.y + b.h + 16)) continue;
    trees.push({ x, y, r: range(rng, 9, 16) });
  }
  // A palm row along the beach promenade.
  for (let y = 120; y < WORLD.height - 100; y += 95) {
    trees.push({ x: 235 + range(rng, -8, 8), y: y + range(rng, -10, 10), r: 13, palm: true });
  }
  // The park lawn is thick with trees.
  for (let i = 0; i < 46; i += 1) {
    trees.push({
      x: range(rng, PARK_RECT.x + 20, PARK_RECT.x + PARK_RECT.w - 20),
      y: range(rng, PARK_RECT.y + 20, PARK_RECT.y + PARK_RECT.h - 20),
      r: range(rng, 10, 18),
    });
  }
  return trees;
}

function onRoadPoint(x, y) {
  const half = ROAD_WIDTH / 2;
  return ROADS_X.some((rx) => Math.abs(x - rx) < half) || ROADS_Y.some((ry) => Math.abs(y - ry) < half);
}

function isWaterPoint(x, y) {
  return x < WATER_EDGE;
}

export function buildCity(rng) {
  const buildings = buildBuildings(rng);
  const trees = buildTrees(rng, buildings);
  return {
    buildings,
    trees,
    park: PARK_RECT,
    waterEdge: WATER_EDGE,
    sandEdge: SAND_EDGE,
    // The pier juts west from Harbor Pier into the ocean.
    pier: { x: 0, y: 1960, w: 150, h: 46 },
    districts: DISTRICTS,
  };
}

/** Which district a point stands in (the beach strip counts as Solmar Beach). */
export function districtAt(city, x, y) {
  for (const d of city.districts) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Costa Solmar';
}

/** True when the point is ocean (west of the sand). */
export function isWater(city, x, y) {
  return x < city.waterEdge;
}

/** True when the point is on the sand strip between ocean and city. */
export function isBeach(city, x, y) {
  return x >= city.waterEdge && x < city.sandEdge;
}

/** True when the point is on a road (not sidewalk or block). */
export function onRoad(x, y) {
  return onRoadPoint(x, y);
}

/** True when a circle of radius r overlaps a building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Push a circle out of buildings and the world edge; returns true if moved. */
export function resolveSolids(city, p, r) {
  let moved = false;
  const b = hitsBuilding(city, p.x, p.y, r);
  if (b) {
    const dxLeft = p.x + r - b.x;
    const dxRight = b.x + b.w - (p.x - r);
    const dyTop = p.y + r - b.y;
    const dyBottom = b.y + b.h - (p.y - r);
    const m = Math.min(dxLeft, dxRight, dyTop, dyBottom);
    if (m === dxLeft) p.x = b.x - r;
    else if (m === dxRight) p.x = b.x + b.w + r;
    else if (m === dyTop) p.y = b.y - r;
    else p.y = b.y + b.h + r;
    moved = true;
  }
  const cx = Math.max(r, Math.min(WORLD.width - r, p.x));
  const cy = Math.max(r, Math.min(WORLD.height - r, p.y));
  if (cx !== p.x || cy !== p.y) {
    p.x = cx;
    p.y = cy;
    moved = true;
  }
  return moved;
}

/** The nearest point on any road centreline to (x, y). */
export function nearestRoadPoint(x, y) {
  let bestX = ROADS_X[0];
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; bestX = rx; }
  }
  let bestY = ROADS_Y[0];
  bestD = Infinity;
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; bestY = ry; }
  }
  if (Math.abs(x - bestX) <= Math.abs(y - bestY)) return { x: bestX, y };
  return { x, y: bestY };
}

/** A random point on a random road, for spawning cars and pedestrians. */
export function randomRoadPoint(rng) {
  if (chance(rng, 0.5)) {
    return { x: pick(rng, ROADS_X), y: range(rng, 140, WORLD.height - 140) };
  }
  return { x: range(rng, 140, WORLD.width - 140), y: pick(rng, ROADS_Y) };
}

/** A random point on the sidewalk beside a road (pedestrian territory). */
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const off = (ROAD_WIDTH / 2 + 16) * (chance(rng, 0.5) ? 1 : -1);
  if (chance(rng, 0.5)) p.x += off;
  else p.y += off;
  p.x = Math.max(120, Math.min(WORLD.width - 40, p.x));
  p.y = Math.max(120, Math.min(WORLD.height - 40, p.y));
  return p;
}
