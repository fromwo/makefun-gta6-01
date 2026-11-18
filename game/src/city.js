// city.js — Costa Solmar: a seeded procedural city. Grid roads, blocks of
// buildings, a beach along the south shore, a central park and eastern docks.
// Provides collision (building rectangles), road queries and spawn points.
import { WORLD, DISTRICTS, COLORS } from './config.js';
import { makeRng } from './random.js';

export class City {
  constructor(seed = 20261118) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.buildings = [];
    this.palms = [];
    this.roadXs = []; this.roadYs = [];
    for (let x = WORLD.roadEvery; x < WORLD.w; x += WORLD.roadEvery) this.roadXs.push(x);
    for (let y = WORLD.roadEvery; y < WORLD.h; y += WORLD.roadEvery) this.roadYs.push(y);
    this.buildCity();
  }
  isRoad(x, y) {
    const rw = WORLD.roadWidth / 2;
    for (const rx of this.roadXs) if (Math.abs(x - rx) < rw) return true;
    for (const ry of this.roadYs) if (Math.abs(y - ry) < rw) return true;
    return false;
  }
  isBeach(x, y) { return y > WORLD.h - 260; }
  isWater(x, y) { return y > WORLD.h - 90; }
  isPark(x, y) { return x > 800 && x < 1600 && y > 800 && y < 1600; }
  isDock(x, y) { return x > 2400 && y < 800; }
  districtAt(x, y) {
    for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
    return 'Costa Solmar';
  }
  buildCity() {
    const rng = this.rng;
    const inset = WORLD.roadWidth / 2 + 26;
    for (let bx = 0; bx < WORLD.w / WORLD.roadEvery; bx++) {
      for (let by = 0; by < WORLD.h / WORLD.roadEvery; by++) {
        const x0 = bx * WORLD.roadEvery, y0 = by * WORLD.roadEvery;
        const cx = x0 + WORLD.roadEvery / 2, cy = y0 + WORLD.roadEvery / 2;
        if (this.isPark(cx, cy) || this.isBeach(cy, cy)) continue;
        if (this.isDock(cx, cy) && rng.chance(0.5)) continue;
        const n = rng.int(2, 4);
        for (let i = 0; i < n; i++) {
          const bw = rng.range(70, 130), bh = rng.range(70, 130);
          const px = x0 + inset + rng.range(0, WORLD.roadEvery - inset * 2 - bw);
          const py = y0 + inset + rng.range(0, WORLD.roadEvery - inset * 2 - bh);
          const palette = ['#b08968', '#a67c52', '#8f9bb0', '#c2a878', '#7d8ba0', '#b57e6a'];
          this.buildings.push({
            x: px, y: py, w: bw, h: bh, color: rng.pick(palette),
            height: rng.int(1, 4), windows: rng.int(2, 5),
            name: rng.pick(['Apts', 'Offices', 'Shops', 'Hotel', 'Lofts', 'Market']),
          });
        }
      }
    }
    // Palm trees along the beachfront and the park paths.
    for (let i = 0; i < 90; i++) {
      const x = rng.range(60, WORLD.w - 60);
      const y = rng.chance(0.6) ? rng.range(WORLD.h - 250, WORLD.h - 110) : rng.range(820, 1580);
      if (!this.isRoad(x, y) && !this.hitsBuilding(x, y, 10)) this.palms.push({ x, y, s: rng.range(0.8, 1.3) });
    }
    // Crates and containers on the docks.
    this.crates = [];
    for (let i = 0; i < 26; i++) {
      this.crates.push({
        x: rng.range(2450, 3100), y: rng.range(120, 700),
        w: rng.range(36, 70), h: rng.range(30, 50),
        color: rng.pick(['#c96a3b', '#4d7ea6', '#7fae62', '#b0a24d']),
      });
    }
  }
  hitsBuilding(x, y, r) {
    for (const b of this.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
    }
    for (const c of this.crates || []) {
      if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) return c;
    }
    return null;
  }
  // Push a circle out of buildings / world bounds. Returns the building hit, if any.
  collideCircle(x, y, r) {
    let hit = null;
    for (const b of this.buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) { hit = b; break; }
    }
    if (!hit) for (const c of this.crates) {
      if (x + r > c.x && x - r < c.x + c.w && y + r > c.y && y - r < c.y + c.h) { hit = c; break; }
    }
    return hit;
  }
  resolveCircle(pos, r) {
    const b = this.collideCircle(pos.x, pos.y, r);
    if (!b) return null;
    const dxl = pos.x + r - b.x, dxr = b.x + b.w - (pos.x - r);
    const dyt = pos.y + r - b.y, dyb = b.y + b.h - (pos.y - r);
    const m = Math.min(dxl, dxr, dyt, dyb);
    if (m === dxl) pos.x = b.x - r; else if (m === dxr) pos.x = b.x + b.w + r;
    else if (m === dyt) pos.y = b.y - r; else pos.y = b.y + b.h + r;
    return b;
  }
  // Nearest point on the road network (for spawning cars / cops).
  nearestRoadPoint(x, y) {
    let bx = this.roadXs[0], by = this.roadYs[0];
    for (const rx of this.roadXs) if (Math.abs(rx - x) < Math.abs(bx - x)) bx = rx;
    for (const ry of this.roadYs) if (Math.abs(ry - y) < Math.abs(by - y)) by = ry;
    return Math.abs(bx - x) < Math.abs(by - y) ? { x: bx, y } : { x, y: by };
  }
  randomRoadPoint(rng) {
    if (rng.chance(0.5)) return { x: rng.pick(this.roadXs), y: rng.range(80, WORLD.h - 320) };
    return { x: rng.range(80, WORLD.w - 80), y: rng.pick(this.roadYs) };
  }
  // Named story locations (fixed, so missions always work).
  locations() {
    return {
      hideout: { x: 600, y: 600, name: 'Rook Hideout' },
      marina: { x: 400, y: 200, name: 'Marina Bay' },
      bank: { x: 1800, y: 1000, name: 'Solmar Savings Bank' },
      garage: { x: 2600, y: 1400, name: 'Docks Garage' },
      beachBar: { x: 1200, y: 2050, name: 'The Tidal Bar' },
      market: { x: 2000, y: 1000, name: 'Market Row' },
      parkGate: { x: 1200, y: 1200, name: 'Central Park Gate' },
      pier: { x: 2800, y: 2100, name: 'Sunset Pier' },
    };
  }
}
