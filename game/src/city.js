// Costa Solmar's city: generation and ground drawing.
// A seeded grid city — roads every 600 px, building blocks between them, a sandy
// beach and sea on the west edge, Verde Park in the middle, and the Marina Bay
// basin in the south-east. Drawn as flat shaded 2D shapes with window grids.
import { WORLD_W, WORLD_H, ROAD_W, ROADS_X, ROADS_Y, DISTRICT_COLORS, districtAt } from './config.js';
import { makeRng, pick, range, rangeInt } from './random.js';

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  // One block between each pair of neighbouring roads.
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Y.length - 1; j++) {
      const bx0 = ROADS_X[i] + ROAD_W / 2 + 16;
      const bx1 = ROADS_X[i + 1] - ROAD_W / 2 - 16;
      const by0 = ROADS_Y[j] + ROAD_W / 2 + 16;
      const by1 = ROADS_Y[j + 1] - ROAD_W / 2 - 16;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      // Verde Park block stays green; Marina Bay block stays water.
      if (cx >= 2100 && cx < 2700 && cy >= 1500 && cy < 2100) {
        for (let t = 0; t < 26; t++) trees.push({ x: range(rng, bx0 + 20, bx1 - 20), y: range(rng, by0 + 20, by1 - 20), r: range(rng, 12, 22), park: true });
        continue;
      }
      if (cx >= 3900 && cy >= 2700) continue;
      const palette = DISTRICT_COLORS[districtAt(cx, cy)] || DISTRICT_COLORS['Downtown Solmar'];
      const n = rangeInt(rng, 2, 4);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 90, 170);
        const h = range(rng, 90, 170);
        const x = range(rng, bx0, Math.max(bx0 + 1, bx1 - w));
        const y = range(rng, by0, Math.max(by0 + 1, by1 - h));
        buildings.push({
          x, y, w, h, color: pick(rng, palette),
          floors: rangeInt(rng, 1, 5), roof: pick(rng, ['#5b6b7a', '#7a5b4a', '#4a5a6a', '#8a7a5a']),
        });
      }
      // A couple of street trees per block edge.
      for (let t = 0; t < 3; t++) trees.push({ x: range(rng, bx0, bx1), y: range(rng, by0, by1), r: range(rng, 9, 15), park: false });
    }
  }
  // Palm trees along the beach and lamps at every intersection.
  for (let y = 120; y < WORLD_H; y += 130) trees.push({ x: 250 + range(rng, -14, 14), y, r: 16, palm: true });
  for (const rx of ROADS_X) for (const ry of ROADS_Y) lamps.push({ x: rx + ROAD_W / 2 + 8, y: ry - ROAD_W / 2 - 8 });
  return { buildings, trees, lamps };
}

// True when the point is on a road surface (used by traffic and pedestrians).
export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

// Nearest point on the road grid, for respawning cars and cops.
export function nearestRoadPoint(x, y) {
  let bx = ROADS_X[0], bd = 1e9;
  for (const rx of ROADS_X) if (Math.abs(x - rx) < bd) { bd = Math.abs(x - rx); bx = rx; }
  let by = ROADS_Y[0]; bd = 1e9;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < bd) { bd = Math.abs(y - ry); by = ry; }
  return Math.abs(x - bx) < Math.abs(y - by) ? { x: bx, y } : { x, y: by };
}

export function drawGround(ctx, cam, vw, vh) {
  const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
  const x1 = x0 + vw, y1 = y0 + vh;
  // Base grass.
  ctx.fillStyle = '#79a75e';
  ctx.fillRect(x0, y0, vw, vh);
  // Sea (west) and sand (beach strip).
  ctx.fillStyle = '#2f7fc2';
  ctx.fillRect(x0, y0, Math.min(x1, 110) - x0 > 0 ? Math.min(x1, 110) - x0 : 0, vh);
  ctx.fillStyle = '#efd9a0';
  ctx.fillRect(Math.max(x0, 110), y0, Math.min(x1, 260) - Math.max(x0, 110) > 0 ? Math.min(x1, 260) - Math.max(x0, 110) : 0, vh);
  // Marina Bay basin (south-east water).
  ctx.fillStyle = '#2f7fc2';
  ctx.fillRect(3900, 2700, 900, 900);
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(3900, 2700, 900, 14);
  ctx.fillRect(3900, 2700, 14, 900);
  // Verde Park lawn and pond.
  ctx.fillStyle = '#5d9a52';
  ctx.fillRect(2160, 1560, 480, 480);
  ctx.fillStyle = '#3f8fbf';
  ctx.beginPath(); ctx.ellipse(2400, 1800, 90, 60, 0, 0, Math.PI * 2); ctx.fill();
  // Roads: asphalt, centre dashes, sidewalk edging.
  for (const rx of ROADS_X) {
    ctx.fillStyle = '#3c3f45';
    ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, vh);
    ctx.fillStyle = '#c9c2b4';
    ctx.fillRect(rx - ROAD_W / 2 - 8, y0, 8, vh);
    ctx.fillRect(rx + ROAD_W / 2, y0, 8, vh);
    ctx.fillStyle = '#e8c33a';
    for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) ctx.fillRect(rx - 3, y, 6, 30);
  }
  for (const ry of ROADS_Y) {
    ctx.fillStyle = '#3c3f45';
    ctx.fillRect(x0, ry - ROAD_W / 2, vw, ROAD_W);
    ctx.fillStyle = '#c9c2b4';
    ctx.fillRect(x0, ry - ROAD_W / 2 - 8, vw, 8);
    ctx.fillRect(x0, ry + ROAD_W / 2, vw, 8);
    ctx.fillStyle = '#e8c33a';
    for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) ctx.fillRect(x, ry - 3, 30, 6);
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  for (const rx of ROADS_X) for (const ry of ROADS_Y) {
    if (rx < x0 - 100 || rx > x1 + 100 || ry < y0 - 100 || ry > y1 + 100) continue;
    for (let k = -2; k <= 2; k++) ctx.fillRect(rx + k * 16 - 5, ry - ROAD_W / 2 + 6, 10, 18);
  }
  // Dock piers in the marina.
  ctx.fillStyle = '#8a6f4d';
  ctx.fillRect(4050, 2850, 180, 16);
  ctx.fillRect(4250, 3050, 180, 16);
  ctx.fillRect(4050, 3250, 180, 16);
}

// Buildings with roof colour, a window grid and a soft drop shadow.
export function drawBuildings(ctx, city, cam, vw, vh) {
  const x0 = cam.x - vw / 2 - 40, y0 = cam.y - vh / 2 - 40;
  const x1 = cam.x + vw / 2 + 40, y1 = cam.y + vh / 2 + 40;
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,220,0.75)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.min(b.floors, Math.floor(b.h / 26)));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillRect(b.x + 12 + i * ((b.w - 24) / cols), b.y + 12 + j * ((b.h - 24) / rows), 10, 12);
    }
  }
  // Trees: round canopies with trunks; palms get a taller trunk near the beach.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(t.x - 2, t.y - 2, 4, t.palm ? 22 : 8);
    ctx.fillStyle = t.palm ? '#3f9a4d' : '#2f7a3a';
    ctx.beginPath(); ctx.arc(t.x, t.y - (t.palm ? 16 : 6), t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(t.x - 4, t.y - (t.palm ? 20 : 10), t.r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  // Street lamps as small posts with a warm dot.
  ctx.fillStyle = '#2c2c30';
  for (const l of city.lamps) {
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 12);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(l.x, l.y - 4, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c2c30';
  }
}
