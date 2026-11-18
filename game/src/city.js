// Costa Solmar: a seeded grid city. Vertical and horizontal roads run
// every 300 px; the blocks between them hold buildings, the centre block is
// Central Park, the west strip is beach and water, the south-east corner
// holds the docks. Everything is deterministic for a given seed.
import { DISTRICTS, ROAD_HALF, ROAD_STEP, WORLD } from './config.js';
import { chance, pick, range, rangeInt } from './random.js';

const ROOF_COLORS = ['#a8763e', '#7d8a99', '#b0523f', '#5f7d5a', '#8a6f9e', '#4a6b7d'];
const WALL_COLORS = ['#c9a06b', '#b8b0a2', '#d08a6a', '#9fb08a', '#a89cc0', '#8fb0c0'];

function roadLines() {
  const vertical = [];
  const horizontal = [];
  for (let x = ROAD_STEP; x < WORLD.width; x += ROAD_STEP) vertical.push(x);
  for (let y = ROAD_STEP; y < WORLD.height; y += ROAD_STEP) horizontal.push(y);
  return { vertical, horizontal };
}

export function buildCity(random) {
  const roads = roadLines();
  const buildings = [];
  const trees = [];
  const parkingSpots = [];
  const cashSpots = [];

  // Buildings fill every block except the park, the beach strip and the
  // dock corner. Each block gets one to three buildings with a roof colour.
  for (let bx = 0; bx < roads.vertical.length - 1; bx += 1) {
    for (let by = 0; by < roads.horizontal.length - 1; by += 1) {
      const x0 = roads.vertical[bx] + ROAD_HALF + 16;
      const x1 = roads.vertical[bx + 1] - ROAD_HALF - 16;
      const y0 = roads.horizontal[by] + ROAD_HALF + 16;
      const y1 = roads.horizontal[by + 1] - ROAD_HALF - 16;
      if (x0 < 260) continue; // beach strip stays open
      if (x0 >= 1080 && x0 < 1860 && y0 >= 860 && y0 < 1440) continue; // Central Park
      if (x0 >= 2760 && y0 >= 2060) continue; // docks stay open
      const count = rangeInt(random, 1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = range(random, 90, Math.min(200, (x1 - x0) / count));
        const h = range(random, 80, 170);
        const x = range(random, x0, Math.max(x0 + 1, x1 - w));
        const y = range(random, y0, Math.max(y0 + 1, y1 - h));
        let overlaps = false;
        for (const b of buildings) {
          if (x < b.x + b.w + 12 && x + w > b.x - 12 && y < b.y + b.h + 12 && y + h > b.y - 12) { overlaps = true; break; }
        }
        if (overlaps) continue;
        buildings.push({
          x, y, w, h,
          wall: pick(random, WALL_COLORS),
          roof: pick(random, ROOF_COLORS),
          floors: rangeInt(random, 1, 4),
          sign: chance(random, 0.3),
        });
      }
    }
  }

  // Palm trees line the beach and fill the park; a few shade the plazas.
  for (let y = 340; y < WORLD.height - 200; y += 130) {
    trees.push({ x: 205 + range(random, -8, 8), y, palm: true });
  }
  for (let i = 0; i < 46; i += 1) {
    trees.push({ x: range(random, 1120, 1820), y: range(random, 900, 1400), palm: chance(random, 0.5) });
  }
  for (let i = 0; i < 30; i += 1) {
    const vx = pick(random, roads.vertical);
    const hy = pick(random, roads.horizontal);
    trees.push({ x: vx + (chance(random, 0.5) ? 52 : -52), y: hy + range(random, -120, 120), palm: true });
  }

  // Parked cars wait along the roads, ready to be borrowed. A spot never
  // sits on an intersection, so a parked car never blocks a crossing.
  const parkedTypes = ['sedan', 'taxi', 'coupe', 'van', 'sport', 'sedan', 'truck'];
  function clearOfCrossRoads(vertical, line, along) {
    const cross = vertical ? roads.horizontal : roads.vertical;
    for (const other of cross) if (Math.abs(along - other) < 95) return false;
    return true;
  }
  for (let i = 0; i < 26; i += 1) {
    const vertical = chance(random, 0.5);
    const line = vertical ? pick(random, roads.vertical) : pick(random, roads.horizontal);
    const along = range(random, 360, WORLD.height - 360);
    if (!clearOfCrossRoads(vertical, line, along)) continue;
    parkingSpots.push({
      x: vertical ? line + 52 : along,
      y: vertical ? along : line + 52,
      angle: vertical ? Math.PI / 2 : 0,
      type: pick(random, parkedTypes),
    });
  }

  // Street cash: dropped bills the player can pick up on foot.
  for (let i = 0; i < 18; i += 1) {
    const vx = pick(random, roads.vertical);
    const hy = pick(random, roads.horizontal);
    cashSpots.push({ x: vx + range(random, -90, 90), y: hy + range(random, -90, 90), amount: rangeInt(random, 15, 60) });
  }

  return { roads, buildings, trees, parkingSpots, cashSpots };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  if (x < 240) return 'Solmar Beach';
  return 'Costa Solmar';
}

export function isRoad(x, y, city) {
  for (const vx of city.roads.vertical) if (Math.abs(x - vx) <= ROAD_HALF) return true;
  for (const hy of city.roads.horizontal) if (Math.abs(y - hy) <= ROAD_HALF) return true;
  return false;
}

export function inWater(x, y) {
  return x < 150;
}

// Push a circle out of every building it overlaps and out of the world
// edge. Returns true when anything pushed back (a hit for sound/damage).
export function collideCircle(pos, radius, city) {
  let hit = false;
  if (pos.x < 170 + radius) { pos.x = 170 + radius; hit = true; }
  if (pos.x > WORLD.width - radius) { pos.x = WORLD.width - radius; hit = true; }
  if (pos.y < radius) { pos.y = radius; hit = true; }
  if (pos.y > WORLD.height - radius) { pos.y = WORLD.height - radius; hit = true; }
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - nx;
    const dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.y = ny + (dy / d) * radius;
      } else {
        pos.y = b.y - radius;
      }
    }
  }
  return hit;
}

export function nearestRoadPoint(x, y, city) {
  let best = null;
  let bestD = Infinity;
  for (const vx of city.roads.vertical) {
    const d = Math.abs(x - vx);
    if (d < bestD) { bestD = d; best = { x: vx, y }; }
  }
  for (const hy of city.roads.horizontal) {
    const d = Math.abs(y - hy);
    if (d < bestD) { bestD = d; best = { x, y: hy }; }
  }
  return best;
}
