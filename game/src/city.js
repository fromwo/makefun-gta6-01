// Solmar Heat — the city of Solmar.
// A fixed seed builds one 9x9 block grid: named districts, a beach and sea
// on the west edge, Central Park in the middle, and a working harbor in the
// east. Roads run between every block; buildings fill the blocks.
import { TILE, WORLD_COLS, WORLD_ROWS, WORLD_W, WORLD_H, DISTRICT_NAMES } from './config.js';
import { makeRng, clamp } from './random.js';

export const ROAD_EVERY = 5; // a road tile line every 5 tiles
export const SEA_COLS = 2; // westernmost tile columns are open sea
export const BEACH_COLS = 2; // next columns are sand beach
export const PORT_COLS = 3; // easternmost tile columns are the harbor

const ROOF_COLORS = ['#8a6f5c', '#a87c5a', '#7d8aa0', '#b09a6a', '#6f7f6a', '#94685e', '#5f7f95', '#c0a080'];
const WALL_COLORS = ['#d8c9b0', '#c9b8a3', '#b7c4d0', '#e0d4c0', '#c2b49a'];

function isRoadTile(c, r) {
  return c % ROAD_EVERY === 0 || r % ROAD_EVERY === 0;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const containers = [];
  const lamps = [];

  // Park occupies the central block (block 4,4).
  const park = {
    x: 4 * ROAD_EVERY * TILE + TILE,
    y: 4 * ROAD_EVERY * TILE + TILE,
    w: (ROAD_EVERY - 1) * TILE,
    h: (ROAD_EVERY - 1) * TILE,
  };

  for (let by = 0; by < 9; by++) {
    for (let bx = 0; bx < 9; bx++) {
      const bx0 = bx * ROAD_EVERY * TILE + TILE;
      const by0 = by * ROAD_EVERY * TILE + TILE;
      const bw = (ROAD_EVERY - 1) * TILE;
      const bh = (ROAD_EVERY - 1) * TILE;
      const westBeach = bx <= 0;
      const eastPort = bx >= 8;
      if (bx === 4 && by === 4) {
        for (let i = 0; i < 14; i++) {
          trees.push({ x: bx0 + rng.range(16, bw - 16), y: by0 + rng.range(16, bh - 16), r: rng.range(9, 15) });
        }
        continue;
      }
      if (westBeach) {
        for (let i = 0; i < 3; i++) trees.push({ x: bx0 + rng.range(10, bw - 10), y: by0 + rng.range(10, bh - 10), r: rng.range(8, 13) });
        continue;
      }
      if (eastPort) {
        for (let i = 0; i < 5; i++) {
          containers.push({
            x: bx0 + rng.range(6, bw - 60), y: by0 + rng.range(6, bh - 26),
            w: rng.range(44, 66), h: 22, color: rng.pick(['#c25e3a', '#3a7fc2', '#4d9e4d', '#c2a23a']),
          });
        }
        continue;
      }
      // One or two buildings per block, with a yard gap between them.
      const count = rng.chance(0.55) ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = rng.range(70, count === 1 ? bw - 24 : bw / 2 - 18);
        const h = rng.range(70, bh - 24);
        const x = count === 1 ? bx0 + (bw - w) / 2 : bx0 + 10 + i * (bw / 2);
        const y = by0 + (bh - h) / 2 + rng.range(-8, 8);
        buildings.push({
          x, y, w, h,
          roof: rng.pick(ROOF_COLORS),
          wall: rng.pick(WALL_COLORS),
          height: rng.int(1, 4),
        });
      }
      if (rng.chance(0.6)) trees.push({ x: bx0 + rng.range(12, bw - 12), y: by0 + rng.range(12, bh - 12), r: rng.range(8, 12) });
    }
  }

  // Street lamps along the main avenues.
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (rng.chance(0.5)) lamps.push({ x: i * ROAD_EVERY * TILE + TILE / 2, y: j * ROAD_EVERY * TILE + 8 });
    }
  }

  const city = {
    buildings, trees, containers, lamps, park,
    sea: { x: 0, y: 0, w: SEA_COLS * TILE, h: WORLD_H },
    beach: { x: SEA_COLS * TILE, y: 0, w: BEACH_COLS * TILE, h: WORLD_H },
    port: { x: WORLD_W - PORT_COLS * TILE, y: 0, w: PORT_COLS * TILE, h: WORLD_H },
    roadEvery: ROAD_EVERY,
    isRoadTile,
    isRoad(x, y) {
      const c = Math.floor(x / TILE);
      const r = Math.floor(y / TILE);
      return c >= 0 && r >= 0 && c < WORLD_COLS && r < WORLD_ROWS && isRoadTile(c, r);
    },
    isWater(x, y) { return x >= 0 && x < SEA_COLS * TILE && y >= 0 && y < WORLD_H; },
    isBeach(x, y) {
      return x >= SEA_COLS * TILE && x < (SEA_COLS + BEACH_COLS) * TILE && y >= 0 && y < WORLD_H;
    },
    districtAt(x, y) {
      const gx = clamp(Math.floor(x / (WORLD_W / 3)), 0, 2);
      const gy = clamp(Math.floor(y / (WORLD_H / 3)), 0, 2);
      return DISTRICT_NAMES[gy * 3 + gx];
    },
    // Circle-vs-rectangle collision against buildings and containers.
    collides(x, y, r) {
      if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return true;
      if (this.isWater(x, y)) return true;
      for (const b of buildings) {
        if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
      }
      for (const c of containers) {
        if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return true;
      }
      return false;
    },
    // Push a circle out of whatever it overlaps; returns true if it hit something.
    resolveCircle(e, r) {
      let hit = false;
      for (const b of buildings) {
        const cx = clamp(e.x, b.x, b.x + b.w);
        const cy = clamp(e.y, b.y, b.y + b.h);
        const dx = e.x - cx;
        const dy = e.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 0.01) {
            const d = Math.sqrt(d2);
            e.x = cx + (dx / d) * r;
            e.y = cy + (dy / d) * r;
          } else {
            e.y = b.y - r;
          }
        }
      }
      return hit;
    },
    // A road intersection near the middle of the map: the player's home corner.
    // Tile 20 is a road line (20 % 5 === 0), so the spawn is on asphalt.
    playerStart() { return { x: 20 * TILE + TILE / 2, y: 20 * TILE + TILE / 2 }; },
    roadPoint(col, row) { return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 }; },
  };

  // Deterministic roadside car spawn points.
  city.carSpawns = [];
  for (let i = 0; i < 26; i++) {
    const vertical = rng.chance(0.5);
    const line = rng.int(1, 8) * ROAD_EVERY;
    const along = rng.int(1, 8) * ROAD_EVERY + rng.int(0, 3);
    const p = vertical ? { x: line * TILE + TILE / 2, y: along * TILE + TILE / 2, angle: Math.PI / 2 }
      : { x: along * TILE + TILE / 2, y: line * TILE + TILE / 2, angle: 0 };
    if (p.x > (SEA_COLS + BEACH_COLS) * TILE + 40 && p.x < WORLD_W - PORT_COLS * TILE - 40) city.carSpawns.push(p);
  }
  // Deterministic cash pickup spots on sidewalks.
  city.pickupSpots = [];
  for (let i = 0; i < 10; i++) {
    const col = rng.int(1, 8) * ROAD_EVERY + 1;
    const row = rng.int(1, 8) * ROAD_EVERY + 1;
    city.pickupSpots.push({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2, amount: rng.pick([25, 40, 60, 100]) });
  }
  return city;
}
